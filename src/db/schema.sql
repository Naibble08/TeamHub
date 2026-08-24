-- TeamHub — схема базы данных (SQLite)
-- Основные сущности: пользователи, задачи, исполнители задач, документы, сообщения (п. 6.3 ТЗ)

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  login         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  position      TEXT NOT NULL DEFAULT '',
  birth_day     INTEGER,              -- 1..31, без года (п. 6.3)
  birth_month   INTEGER,              -- 1..12
  role          TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  due_date     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'overdue')),
  creator_id   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deadline_reminder_sent_at TEXT
);

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  stored_name   TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL DEFAULT 'application/octet-stream',
  size          INTEGER NOT NULL,
  uploader_id   INTEGER NOT NULL REFERENCES users(id),
  recipient_id  INTEGER REFERENCES users(id), -- NULL = все сотрудники
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id         INTEGER REFERENCES users(id), -- NULL для системных сообщений (напоминания)
  recipient_id      INTEGER REFERENCES users(id), -- NULL = общий канал "для всех"
  content           TEXT NOT NULL,
  is_llm_generated  INTEGER NOT NULL DEFAULT 0,
  llm_provider      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_general ON messages (recipient_id, created_at);

-- Журнал обращений к LLM-провайдеру (п. 5.6.4)
CREATE TABLE IF NOT EXISTS llm_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
  request_type  TEXT NOT NULL, -- birthday_greeting | task_reminder | assistant_message
  initiator_id  INTEGER REFERENCES users(id), -- NULL — инициировано планировщиком
  provider      TEXT NOT NULL,
  result        TEXT NOT NULL CHECK (result IN ('success', 'error', 'timeout')),
  duration_ms   INTEGER,
  error_message TEXT
);

-- Настройки, изменяемые администратором без редактирования файла конфигурации (п. 5.6.7)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
