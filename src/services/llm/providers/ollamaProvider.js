const config = require('../../../config');

const name = 'ollama';

// Полностью локальный вариант — данные не покидают периметр организации (п. 5.6.5).
async function generate(prompt, systemInstruction, timeoutMs, signal) {
  const { baseUrl, model } = config.llm.providers.ollama;

  const resp = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      system: systemInstruction || undefined,
      stream: false,
    }),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Ollama API вернул ошибку ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = (data?.response || '').trim();
  if (!text) throw new Error('Ollama API вернул пустой ответ');
  return text;
}

module.exports = { name, generate };
