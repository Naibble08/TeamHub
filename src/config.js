const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'config.json');
const EXAMPLE_PATH = path.join(__dirname, '..', 'config', 'config.example.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const example = JSON.parse(fs.readFileSync(EXAMPLE_PATH, 'utf8'));
    example.auth.jwtSecret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(example, null, 2));
    // eslint-disable-next-line no-console
    console.log(`[config] Файл config/config.json не найден — создан автоматически со случайным jwtSecret.`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);

  if (!config.auth || !config.auth.jwtSecret || config.auth.jwtSecret === 'CHANGE_ME_TO_A_RANDOM_SECRET') {
    throw new Error('config/config.json: auth.jwtSecret не задан. Укажите случайную строку перед запуском в эксплуатацию.');
  }

  return config;
}

module.exports = loadConfig();
