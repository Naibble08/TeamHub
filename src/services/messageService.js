const db = require('../db');

function toDto(m) {
  return {
    id: m.id,
    senderId: m.sender_id,
    senderName: m.sender_first_name ? `${m.sender_first_name} ${m.sender_last_name}` : 'Система',
    recipientId: m.recipient_id,
    content: m.content,
    isLlmGenerated: !!m.is_llm_generated,
    llmProvider: m.llm_provider,
    createdAt: m.created_at,
  };
}

const SELECT = `
  SELECT m.*, u.first_name AS sender_first_name, u.last_name AS sender_last_name
  FROM messages m LEFT JOIN users u ON u.id = m.sender_id
`;

function createMessage({ senderId, recipientId, content, isLlmGenerated = false, llmProvider = null }) {
  const info = db
    .prepare(
      `INSERT INTO messages (sender_id, recipient_id, content, is_llm_generated, llm_provider)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(senderId, recipientId, content, isLlmGenerated ? 1 : 0, llmProvider);

  const row = db.prepare(`${SELECT} WHERE m.id = ?`).get(info.lastInsertRowid);
  return toDto(row);
}

function getGeneralHistory(limit = 100) {
  const rows = db
    .prepare(`${SELECT} WHERE m.recipient_id IS NULL ORDER BY m.id DESC LIMIT ?`)
    .all(limit);
  return rows.reverse().map(toDto);
}

function getDirectHistory(userA, userB, limit = 100) {
  const rows = db
    .prepare(
      `${SELECT}
       WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
       ORDER BY m.id DESC LIMIT ?`
    )
    .all(userA, userB, userB, userA, limit);
  return rows.reverse().map(toDto);
}

// Личные автоматические напоминания (п. 5.5) — sender_id IS NULL, адресованы конкретному
// сотруднику. Отдельная выборка, т.к. они не относятся ни к одной паре "сотрудник-сотрудник".
function getSystemHistory(userId, limit = 100) {
  const rows = db
    .prepare(
      `${SELECT} WHERE m.sender_id IS NULL AND m.recipient_id = ? ORDER BY m.id DESC LIMIT ?`
    )
    .all(userId, limit);
  return rows.reverse().map(toDto);
}

module.exports = { createMessage, getGeneralHistory, getDirectHistory, getSystemHistory, toDto };
