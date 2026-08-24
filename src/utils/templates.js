// Заранее заданные шаблоны — используются, когда LLM-провайдер недоступен
// или превышено время ожидания ответа (п. 5.6.1, 5.6.6).

const BIRTHDAY_TEMPLATES = [
  '🎉 {name}, с днём рождения! Желаем отличного настроения, интересных задач и заслуженного отдыха!',
  '🎂 Поздравляем {name} с днём рождения! Пусть всё задуманное получается легко и вовремя.',
  '🎈 С днём рождения, {name}! Спасибо за твою работу в команде — успехов и хорошего дня!',
];

const REMINDER_UPCOMING_TEMPLATES = [
  '{name}, напоминаем: срок задачи «{task}» истекает {dueDate}. Не забудь завершить её вовремя!',
  '{name}, подходит срок по задаче «{task}» ({dueDate}). Как продвигается выполнение?',
];

const REMINDER_OVERDUE_TEMPLATES = [
  '{name}, задача «{task}» просрочена (срок был {dueDate}). Пожалуйста, обнови статус или заверши её.',
  '{name}, обрати внимание: срок задачи «{task}» уже прошёл ({dueDate}). Нужна твоя помощь, чтобы закрыть её.',
];

const ASSISTANT_FALLBACK =
  'Сервис ИИ сейчас недоступен, автоматически сформировать сообщение не удалось. Опишите суть сообщения и отправьте его самостоятельно.';

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : ''));
}

function birthdayTemplate(vars) {
  return fillTemplate(pickRandom(BIRTHDAY_TEMPLATES), vars);
}

function reminderTemplate(vars, isOverdue) {
  const list = isOverdue ? REMINDER_OVERDUE_TEMPLATES : REMINDER_UPCOMING_TEMPLATES;
  return fillTemplate(pickRandom(list), vars);
}

function assistantFallback() {
  return ASSISTANT_FALLBACK;
}

module.exports = { birthdayTemplate, reminderTemplate, assistantFallback };
