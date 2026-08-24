const express = require('express');
const config = require('../config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const settingsService = require('../services/settingsService');
const llmLogService = require('../services/llmLogService');
const reminderService = require('../services/reminderService');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', (req, res) => {
  res.json({
    birthdayReminderEnabled: settingsService.getBool('birthday_reminder_enabled', true),
    deadlineReminderEnabled: settingsService.getBool('deadline_reminder_enabled', true),
    dailyCheckTime: settingsService.get('daily_check_time', '09:00'),
    llmToneInstruction: settingsService.get('llm_tone_instruction', ''),
    // Параметры поставщика LLM — только для чтения здесь, меняются в config/config.json (п. 5.6.1, 5.6.4)
    llmEnabled: config.llm.enabled,
    llmActiveProvider: config.llm.activeProvider,
  });
});

router.put('/', (req, res) => {
  const { birthdayReminderEnabled, deadlineReminderEnabled, dailyCheckTime, llmToneInstruction } =
    req.body || {};

  if (typeof birthdayReminderEnabled === 'boolean') {
    settingsService.set('birthday_reminder_enabled', birthdayReminderEnabled ? '1' : '0');
  }
  if (typeof deadlineReminderEnabled === 'boolean') {
    settingsService.set('deadline_reminder_enabled', deadlineReminderEnabled ? '1' : '0');
  }
  if (typeof dailyCheckTime === 'string' && /^\d{2}:\d{2}$/.test(dailyCheckTime)) {
    settingsService.set('daily_check_time', dailyCheckTime);
  }
  if (typeof llmToneInstruction === 'string') {
    settingsService.set('llm_tone_instruction', llmToneInstruction);
  }

  res.json({ ok: true });
});

// Ручной запуск проверки дней рождения и дедлайнов — для приёмочного контроля (п. 8.1)
router.post('/run-checks', async (req, res) => {
  try {
    await reminderService.runDailyChecks({ force: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при выполнении проверки: ' + err.message });
  }
});

router.get('/llm-logs', (req, res) => {
  const rows = llmLogService.listRecent(200).map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    requestType: r.request_type,
    initiatorId: r.initiator_id,
    provider: r.provider,
    result: r.result,
    durationMs: r.duration_ms,
    errorMessage: r.error_message,
  }));
  res.json(rows);
});

module.exports = router;
