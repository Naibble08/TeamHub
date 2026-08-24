const config = require('../../../config');

const name = 'gemini';

async function generate(prompt, systemInstruction, timeoutMs, signal) {
  const { apiBase, model, apiKey } = config.llm.providers.gemini;
  if (!apiKey) throw new Error('Не задан apiKey для Gemini в config/config.json');

  const url = `${apiBase}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gemini API вернул ошибку ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text.trim()) throw new Error('Gemini API вернул пустой ответ');
  return text.trim();
}

module.exports = { name, generate };
