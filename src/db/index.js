const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'teamhub.db');

const db = new Database(DB_PATH);

// Хранение данных в отказоустойчивом режиме — журналируемая БД, режим WAL (п. 4.4)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const DEFAULT_SETTINGS = {
  birthday_reminder_enabled: '1',
  deadline_reminder_enabled: '1',
  daily_check_time: '09:00',
  llm_tone_instruction:
    'Пиши по-русски, дружелюбно и неформально, коротко (1-3 предложения), без канцеляризмов. Обращайся на "ты", если не сказано иное.',
};

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  insertSetting.run(key, value);
}

const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  const generatedPassword = crypto.randomBytes(9).toString('base64url');
  const hash = bcrypt.hashSync(generatedPassword, 10);
  db.prepare(
    `INSERT INTO users (first_name, last_name, login, password_hash, position, role, is_active)
     VALUES (?, ?, ?, ?, ?, 'admin', 1)`
  ).run('Администратор', 'Системы', 'admin', hash, 'Руководитель');

  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
  console.log('[db] Создана первая учётная запись администратора:');
  console.log('     логин:  admin');
  console.log(`     пароль: ${generatedPassword}`);
  console.log('     Смените пароль после первого входа.');
  console.log('='.repeat(60));
}

module.exports = db;
