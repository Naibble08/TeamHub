const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/tokens');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    login: u.login,
    position: u.position,
    role: u.role,
  };
}

router.post('/login', (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) {
    return res.status(400).json({ error: 'Укажите логин и пароль' });
  }

  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    firstName: req.user.first_name,
    lastName: req.user.last_name,
    login: req.user.login,
    position: req.user.position,
    role: req.user.role,
  });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Новый пароль должен содержать не менее 6 символов' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Текущий пароль указан неверно' });
  }

  const hash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

module.exports = router;
