// Единый программный интерфейс (адаптер) для формирования текстов сообщений через LLM,
// не зависящий от конкретного поставщика модели (п. 5.6.1).
const config = require('../../config');
const settings = require('../settingsService');
const llmLog = require('../llmLogService');
const templates = require('../../utils/templates');
const geminiProvider = require('./providers/geminiProvider');
const ollamaProvider = require('./providers/ollamaProvider');

const PROVIDERS = {
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

// Тексты промптов на основе минимально необходимых сведений — только имя (без фамилии)
// и название задачи; фамилия, должность и прочие данные сотрудника не передаются
// внешнему поставщику (п. 5.6.5).
function buildPrompt(type, context) {
  switch (type) {
    case 'birthday_greeting':
      return `Напиши короткое дружелюбное поздравление с днём рождения для сотрудника по имени ${context.firstName}. Не придумывай лишних деталей о человеке.`;
    case 'task_reminder': {
      const state = context.isOverdue ? 'уже просрочена' : 'скоро истекает срок';
      return `Напиши короткое дружелюбное неформальное напоминание для сотрудника по имени ${context.firstName} о задаче «${context.taskTitle}», у которой ${state} (срок: ${context.dueDate}).`;
    }
    case 'assistant_message':
      return context.instruction;
    default:
      throw new Error(`Неизвестный тип LLM-запроса: ${type}`);
  }
}

function buildFallback(type, context) {
  switch (type) {
    case 'birthday_greeting':
      return templates.birthdayTemplate({ name: context.firstName });
    case 'task_reminder':
      return templates.reminderTemplate(
        { name: context.firstName, task: context.taskTitle, dueDate: context.dueDate },
        context.isOverdue
      );
    case 'assistant_message':
      return templates.assistantFallback();
    default:
      return templates.assistantFallback();
  }
}

async function withTimeout(fn, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{type: string, context: object, initiatorId: number|null}} params
 * @returns {Promise<{text: string, provider: string, isFallback: boolean}>}
 */
async function generateMessage({ type, context, initiatorId = null }) {
  // Полное отключение функций ИИ одним параметром настройки (п. 5.6.5) —
  // Система продолжает работать на шаблонах.
  if (!config.llm.enabled || config.llm.activeProvider === 'template') {
    return { text: buildFallback(type, context), provider: 'template', isFallback: true };
  }

  const provider = PROVIDERS[config.llm.activeProvider];
  if (!provider) {
    return { text: buildFallback(type, context), provider: 'template', isFallback: true };
  }

  const timeoutMs = config.llm.timeoutMs || 10000;
  const prompt = buildPrompt(type, context);
  const systemInstruction = settings.get('llm_tone_instruction', '');

  const start = Date.now();
  try {
    const text = await withTimeout(
      (signal) => provider.generate(prompt, systemInstruction, timeoutMs, signal),
      timeoutMs
    );
    llmLog.logCall({
      requestType: type,
      initiatorId,
      provider: provider.name,
      result: 'success',
      durationMs: Date.now() - start,
    });
    return { text, provider: provider.name, isFallback: false };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    llmLog.logCall({
      requestType: type,
      initiatorId,
      provider: provider.name,
      result: isTimeout ? 'timeout' : 'error',
      durationMs: Date.now() - start,
      errorMessage: String(err.message || err).slice(0, 500),
    });
    // При недоступности провайдера либо превышении тайм-аута — переход на шаблон (п. 5.6.1, 5.6.6).
    return { text: buildFallback(type, context), provider: 'template', isFallback: true };
  }
}

module.exports = { generateMessage };
