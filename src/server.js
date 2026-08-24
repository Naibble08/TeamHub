const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const app = require('./app');
const { registerChat } = require('./sockets/chat');
const reminderService = require('./services/reminderService');

const server = http.createServer(app);
const io = new Server(server);

registerChat(io);
reminderService.startScheduler(io);

const PORT = config.port || 3000;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[TeamHub] Сервер запущен: http://localhost:${PORT}`);
});
