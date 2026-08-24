const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const STATUSES = ['new', 'in_progress', 'done', 'overdue'];

function loadAssignees(taskId) {
  return db
    .prepare(
      `SELECT u.id, u.first_name, u.last_name
       FROM task_assignees ta JOIN users u ON u.id = ta.user_id
       WHERE ta.task_id = ?`
    )
    .all(taskId)
    .map((u) => ({ id: u.id, firstName: u.first_name, lastName: u.last_name }));
}

function toDto(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.due_date,
    status: t.status,
    creatorId: t.creator_id,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    assignees: loadAssignees(t.id),
  };
}

router.get('/', requireAuth, (req, res) => {
  const scope = req.query.scope === 'all' ? 'all' : 'my';

  if (scope === 'all' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Список всех задач доступен только администратору' });
  }

  let rows;
  if (scope === 'all') {
    rows = db.prepare('SELECT * FROM tasks ORDER BY due_date').all();
  } else {
    rows = db
      .prepare(
        `SELECT DISTINCT t.* FROM tasks t
         LEFT JOIN task_assignees ta ON ta.task_id = t.id
         WHERE ta.user_id = ? OR t.creator_id = ?
         ORDER BY t.due_date`
      )
      .all(req.user.id, req.user.id);
  }

  res.json(rows.map(toDto));
});

router.get('/:id', requireAuth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задача не найдена' });

  const assignees = loadAssignees(task.id);
  const isParty =
    req.user.role === 'admin' ||
    task.creator_id === req.user.id ||
    assignees.some((a) => a.id === req.user.id);
  if (!isParty) return res.status(403).json({ error: 'Нет доступа к задаче' });

  res.json(toDto(task));
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { title, description, dueDate, assigneeIds } = req.body || {};

  if (!title || !dueDate || !Array.isArray(assigneeIds) || assigneeIds.length === 0) {
    return res
      .status(400)
      .json({ error: 'Укажите название, срок и хотя бы одного исполнителя' });
  }

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO tasks (title, description, due_date, status, creator_id)
         VALUES (?, ?, ?, 'new', ?)`
      )
      .run(title, description || '', dueDate, req.user.id);

    const insertAssignee = db.prepare(
      'INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)'
    );
    for (const uid of assigneeIds) insertAssignee.run(info.lastInsertRowid, uid);

    return info.lastInsertRowid;
  });

  const taskId = tx();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(201).json(toDto(task));
});

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Задача не найдена' });

  const { title, description, dueDate, assigneeIds } = req.body || {};

  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, due_date = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title ?? existing.title, description ?? existing.description, dueDate ?? existing.due_date, id);

  if (Array.isArray(assigneeIds)) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(id);
      const insertAssignee = db.prepare(
        'INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)'
      );
      for (const uid of assigneeIds) insertAssignee.run(id, uid);
    });
    tx();
  }

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(toDto(updated));
});

router.post('/:id/status', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  if (!STATUSES.includes(status) || status === 'overdue') {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Задача не найдена' });

  const assignees = loadAssignees(id);
  const canChange =
    req.user.role === 'admin' ||
    task.creator_id === req.user.id ||
    assignees.some((a) => a.id === req.user.id);
  if (!canChange) return res.status(403).json({ error: 'Нет доступа к задаче' });

  db.prepare(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    status,
    id
  );

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(toDto(updated));
});

module.exports = router;
