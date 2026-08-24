const jwt = require('jsonwebtoken');
const config = require('../config');

// Токен авторизации — не более 30 суток (п. 4.6)
const EXPIRES_IN = `${config.auth.tokenExpiryDays || 30}d`;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, login: user.login },
    config.auth.jwtSecret,
    { expiresIn: EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.auth.jwtSecret);
}

module.exports = { signToken, verifyToken };
