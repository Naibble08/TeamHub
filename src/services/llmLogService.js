const db = require('../db');

// Журнал обращений к LLM-провайдеру: дата и время, тип запроса, инициатор,
// используемый провайдер, результат — для контроля и разбора инцидентов (п. 5.6.4).
function logCall({ requestType, initiatorId, provider, result, durationMs, errorMessage }) {
  db.prepare(
    `INSERT INTO llm_logs (request_type, initiator_id, provider, result, duration_ms, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(requestType, initiatorId ?? null, provider, result, durationMs ?? null, errorMessage ?? null);
}

function listRecent(limit = 200) {
  return db.prepare('SELECT * FROM llm_logs ORDER BY id DESC LIMIT ?').all(limit);
}

module.exports = { logCall, listRecent };
