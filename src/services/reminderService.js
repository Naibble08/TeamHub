// Подсистема автоматических напоминаний (п. 5.5) и связанные с ней LLM-функции (п. 5.6.3).
const db = require('../db');
const settings = require('./settingsService');
const messageService = require('./messageService');
const llmAdapter = require('./llm/adapter');

let ioRef = null;
const CHECK_INTERVAL_MS = 60 * 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// due_date хранится как введено пользователем (локальное время, формат "YYYY-MM-DDTHH:MM",
// без часового пояса) — в отличие от системных отметок времени (UTC из SQLite datetime('now')).
// Сравнение строк напрямую в SQL даёт неверный результат из-за разных разделителей ('T' vs ' ')
// и разных часовых поясов, поэтому due_date всегда сравнивается через new Date(...) в JS —
// оба варианта записи ("YYYY-MM-DDTHH:MM" и "YYYY-MM-DD HH:MM:SS") интерпретируются как локальное время.
function isPastDue(dueDate, referenceDate) {
  return new Date(dueDate).getTime() < referenceDate.getTime();
}

// Автоматический перевод задачи в статус «просрочена» при превышении срока (п. 5.2).
// Выполняется независимо от включённости LLM-напоминаний и от расписания ежедневной проверки.
function autoMarkOverdue() {
  const now = new Date();
  const candidates = db.prepare(`SELECT id, due_date FROM tasks WHERE status IN ('new', 'in_progress')`).all();
  const overdue = candidates.filter((t) => isPastDue(t.due_date, now));
  if (overdue.length === 0) return;

  const update = db.prepare(`UPDATE tasks SET status = 'overdue', updated_at = datetime('now') WHERE id = ?`);
  const tx = db.transaction((ids) => { for (const id of ids) update.run(id); });
  tx(overdue.map((t) => t.id));
}

async function sendBirthdayGreetings(now, { force = false } = {}) {
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const people = db
    .prepare('SELECT * FROM users WHERE is_active = 1 AND birth_day = ? AND birth_month = ?')
    .all(day, month);

  for (const person of people) {
    const alreadySentKey = `birthday_sent_${person.id}_${todayKey()}`;
    if (!force && settings.get(alreadySentKey)) continue;

    const result = await llmAdapter.generateMessage({
      type: 'birthday_greeting',
      context: { firstName: person.first_name },
      initiatorId: null,
    });

    const message = messageService.createMessage({
      senderId: null,
      recipientId: null,
      content: result.text,
      isLlmGenerated: !result.isFallback,
      llmProvider: result.provider,
    });

    ioRef?.to('general').emit('chat:message', message);
    settings.set(alreadySentKey, '1');
  }
}

async function sendDeadlineReminders(now, { force = false } = {}) {
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const candidates = force
    ? db.prepare(`SELECT * FROM tasks WHERE status IN ('new', 'in_progress', 'overdue')`).all()
    : db
        .prepare(
          `SELECT * FROM tasks
           WHERE status IN ('new', 'in_progress', 'overdue')
             AND (deadline_reminder_sent_at IS NULL OR date(deadline_reminder_sent_at) != date('now'))`
        )
        .all();

  const dueTasks = candidates.filter((t) => isPastDue(t.due_date, in24h));

  for (const task of dueTasks) {
    const assignees = db
      .prepare(
        `SELECT u.* FROM task_assignees ta JOIN users u ON u.id = ta.user_id
         WHERE ta.task_id = ? AND u.is_active = 1`
      )
      .all(task.id);

    const isOverdue = isPastDue(task.due_date, now);

    for (const person of assignees) {
      const result = await llmAdapter.generateMessage({
        type: 'task_reminder',
        context: {
          firstName: person.first_name,
          taskTitle: task.title,
          dueDate: task.due_date,
          isOverdue,
        },
        initiatorId: null,
      });

      const message = messageService.createMessage({
        senderId: null,
        recipientId: person.id,
        content: result.text,
        isLlmGenerated: !result.isFallback,
        llmProvider: result.provider,
      });

      ioRef?.to(`user:${person.id}`).emit('chat:message', message);
    }

    db.prepare(`UPDATE tasks SET deadline_reminder_sent_at = datetime('now') WHERE id = ?`).run(task.id);
  }
}

// Ручной запуск проверки — для приёмочного контроля (п. 8.1) и по расписанию.
async function runDailyChecks({ force = false } = {}) {
  const now = new Date();
  autoMarkOverdue();

  if (force || settings.getBool('birthday_reminder_enabled', true)) {
    await sendBirthdayGreetings(now, { force });
  }
  if (force || settings.getBool('deadline_reminder_enabled', true)) {
    await sendDeadlineReminders(now, { force });
  }

  settings.set('last_daily_check_date', todayKey());
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function startScheduler(io) {
  ioRef = io;

  setInterval(() => {
    autoMarkOverdue();

    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const configuredTime = settings.get('daily_check_time', '09:00');
    const lastRun = settings.get('last_daily_check_date', '');

    if (hhmm === configuredTime && lastRun !== todayKey()) {
      runDailyChecks().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[reminderService] Ошибка ежедневной проверки:', err);
      });
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = { startScheduler, runDailyChecks, setIo: (io) => { ioRef = io; } };
