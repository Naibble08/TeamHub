const db = require('../db');
const { verifyToken } = require('../utils/tokens');
const messageService = require('../services/messageService');
const llmAdapter = require('../services/llm/adapter');

function userRoom(id) {
  return `user:${id}`;
}

function registerChat(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Требуется авторизация'));
    try {
      const payload = verifyToken(token);
      const user = db
        .prepare('SELECT id, first_name, last_name, role, is_active FROM users WHERE id = ?')
        .get(payload.sub);
      if (!user || !user.is_active) return next(new Error('Учётная запись недоступна'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Недействительный или истёкший токен'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    socket.join(userRoom(user.id));
    socket.join('general');

    // Доставка сообщений в режиме, близком к реальному времени (п. 4.3, 5.4)
    socket.on('chat:send', (payload, ack) => {
      const content = String(payload?.content || '').trim();
      if (!content) return ack?.({ error: 'Пустое сообщение' });
      if (content.length > 4000) return ack?.({ error: 'Сообщение слишком длинное' });

      const toUserId = payload?.toUserId ? Number(payload.toUserId) : null;
      const isLlmGenerated = !!payload?.isLlmGenerated;
      const llmProvider = isLlmGenerated ? payload?.llmProvider || null : null;

      if (toUserId) {
        const recipient = db.prepare('SELECT id FROM users WHERE id = ?').get(toUserId);
        if (!recipient) return ack?.({ error: 'Получатель не найден' });
      }

      const message = messageService.createMessage({
        senderId: user.id,
        recipientId: toUserId,
        content,
        isLlmGenerated,
        llmProvider,
      });

      if (toUserId) {
        io.to(userRoom(toUserId)).to(userRoom(user.id)).emit('chat:message', message);
      } else {
        io.to('general').emit('chat:message', message);
      }
      ack?.({ ok: true, message });
    });

    // Функция «ИИ-ассистент» — генерация сообщения по короткой инструкции пользователя (п. 5.6.3)
    socket.on('chat:ai-generate', async (payload, ack) => {
      const instruction = String(payload?.instruction || '').trim();
      if (!instruction) return ack?.({ error: 'Опишите, о чём сформировать сообщение' });

      const result = await llmAdapter.generateMessage({
        type: 'assistant_message',
        context: { instruction },
        initiatorId: user.id,
      });
      ack?.(result);
    });

    socket.on('disconnect', () => {});
  });
}

module.exports = { registerChat };
