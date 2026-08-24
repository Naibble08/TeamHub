const express = require('express');
const db = require('../db');
const { hashPassword } = require('../utils/password');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function toCard(u) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    login: u.login,
    position: u.position,
    birthDay: u.birth_day,
    birthMonth: u.birth_month,
    role: u.role,
    isActive: !!u.is_active,
  };
}

// Список сотрудников. Обычному сотруднику — только активные и без служебных полей,
// администратору — полные карточки, включая неактивных (п. 5.1).
router.get('/', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    const rows = db.prepare('SELECT * FROM users ORDER BY last_name, first_name').all();
    return res.json(rows.map(toCard));
  }

  const rows = db
    .prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY last_name, first_name')
    .all();
  return res.json(
    rows.map((u) => ({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      position: u.position,
      role: u.role,
    }))
  );
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { firstName, lastName, login, password, position, birthDay, birthMonth, role } =
    req.body || {};

  if (!firstName || !lastName || !login || !password || !role) {
    return res.status(400).json({ error: 'Заполните обязательные поля карточки сотрудника' });
  }
  if (!['admin', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
  if (existing) {
    return res.status(409).json({ error: 'Такой логин уже занят' });
  }

  const hash = hashPassword(password);
  const info = db
    .prepare(
      `INSERT INTO users (first_name, last_name, login, password_hash, position, birth_day, birth_month, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(firstName, lastName, login, hash, position || '', birthDay || null, birthMonth || null, role);

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(toCard(created));
});

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });

  const { firstName, lastName, login, position, birthDay, birthMonth, role, password } =
    req.body || {};

  if (login && login !== existing.login) {
    const dup = db.prepare('SELECT id FROM users WHERE login = ? AND id != ?').get(login, id);
    if (dup) return res.status(409).json({ error: 'Такой логин уже занят' });
  }

  db.prepare(
    `UPDATE users SET
       first_name = ?, last_name = ?, login = ?, position = ?,
       birth_day = ?, birth_month = ?, role = ?
     WHERE id = ?`
  ).run(
    firstName ?? existing.first_name,
    lastName ?? existing.last_name,
    login ?? existing.login,
    position ?? existing.position,
    birthDay === undefined ? existing.birth_day : birthDay,
    birthMonth === undefined ? existing.birth_month : birthMonth,
    role ?? existing.role,
    id
  );

  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(toCard(updated));
});

router.post('/:id/deactivate', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя деактивировать собственную учётную запись' });
  }
  const info = db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Сотрудник не найден' });
  res.json({ ok: true });
});

router.post('/:id/activate', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Сотрудник не найден' });
  res.json({ ok: true });
});

module.exports = router;
