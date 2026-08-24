const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const messageService = require('../services/messageService');

const router = express.Router();

router.get('/general', requireAuth, (req, res) => {
  res.json(messageService.getGeneralHistory(200));
});

// Личные напоминания (дни рождения — в общий чат, дедлайны задач — сюда, см. п. 5.5)
router.get('/system', requireAuth, (req, res) => {
  res.json(messageService.getSystemHistory(req.user.id, 200));
});

router.get('/with/:userId', requireAuth, (req, res) => {
  const peerId = Number(req.params.userId);
  const peer = db.prepare('SELECT id FROM users WHERE id = ?').get(peerId);
  if (!peer) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(messageService.getDirectHistory(req.user.id, peerId, 200));
});

module.exports = router;
