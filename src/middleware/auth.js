const db = require('../db');
const { verifyToken } = require('../utils/tokens');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный или истёкший токен' });
  }

  const user = db
    .prepare('SELECT id, first_name, last_name, login, position, role, is_active FROM users WHERE id = ?')
    .get(payload.sub);

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Учётная запись недоступна' });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
