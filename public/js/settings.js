const RESULT_LABELS = { success: 'успех', error: 'ошибка', timeout: 'тайм-аут' };
const TYPE_LABELS = {
  birthday_greeting: 'поздравление',
  task_reminder: 'напоминание о задаче',
  assistant_message: 'ИИ-ассистент',
};

window.SettingsView = {
  async render(container) {
    const s = await api('GET', '/api/settings');

    container.innerHTML = `
      <h2>Настройки</h2>
      <div class="card">
        <h3 style="margin-top:0;">Функции ИИ</h3>
        <p class="hint" style="margin-top:0;">
          Включение/отключение ИИ и выбор поставщика (облачный/локальный) задаются в файле
          <code>config/config.json</code> на сервере (п. 5.6.1, 5.6.5 ТЗ) — без изменения программного кода.
        </p>
        <p>Состояние: <strong>${s.llmEnabled ? 'включено' : 'отключено'}</strong>,
           поставщик: <strong>${escapeHtml(s.llmActiveProvider)}</strong></p>

        <div class="field">
          <label>Тон и стиль генерируемых сообщений (системная инструкция)</label>
          <textarea id="tone">${escapeHtml(s.llmToneInstruction)}</textarea>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Автоматические напоминания</h3>
        <div class="field">
          <label><input type="checkbox" id="birthday-enabled" ${s.birthdayReminderEnabled ? 'checked' : ''} /> Поздравления с днём рождения</label>
        </div>
        <div class="field">
          <label><input type="checkbox" id="deadline-enabled" ${s.deadlineReminderEnabled ? 'checked' : ''} /> Напоминания о сроках задач</label>
        </div>
        <div class="field" style="max-width:160px;">
          <label>Время ежедневной проверки</label>
          <input type="time" id="check-time" value="${escapeHtml(s.dailyCheckTime)}" />
        </div>
        <div class="toolbar">
          <button class="btn btn-primary btn-sm" id="save-settings-btn">Сохранить</button>
          <button class="btn btn-sm" id="run-checks-btn">Запустить проверку сейчас</button>
        </div>
        <div class="error-msg" id="settings-msg"></div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Журнал обращений к LLM</h3>
        <div id="llm-logs"></div>
      </div>
    `;

    container.querySelector('#save-settings-btn').addEventListener('click', async () => {
      try {
        await api('PUT', '/api/settings', {
          llmToneInstruction: container.querySelector('#tone').value,
          birthdayReminderEnabled: container.querySelector('#birthday-enabled').checked,
          deadlineReminderEnabled: container.querySelector('#deadline-enabled').checked,
          dailyCheckTime: container.querySelector('#check-time').value,
        });
        showToast('Настройки сохранены');
      } catch (err) {
        container.querySelector('#settings-msg').textContent = err.message;
      }
    });

    container.querySelector('#run-checks-btn').addEventListener('click', async () => {
      container.querySelector('#settings-msg').textContent = 'Выполняется проверка…';
      try {
        await api('POST', '/api/settings/run-checks');
        container.querySelector('#settings-msg').textContent = '';
        showToast('Проверка выполнена');
        loadLogs();
      } catch (err) {
        container.querySelector('#settings-msg').textContent = err.message;
      }
    });

    async function loadLogs() {
      const logs = await api('GET', '/api/settings/llm-logs');
      const el = container.querySelector('#llm-logs');
      if (logs.length === 0) {
        el.innerHTML = '<div class="empty-state">Записей пока нет</div>';
        return;
      }
      el.innerHTML = `
        <table>
          <thead><tr><th>Время</th><th>Тип</th><th>Поставщик</th><th>Результат</th><th>Длительность</th></tr></thead>
          <tbody>
            ${logs.map((l) => `
              <tr>
                <td>${formatDateTime(l.timestamp)}</td>
                <td>${TYPE_LABELS[l.requestType] || escapeHtml(l.requestType)}</td>
                <td>${escapeHtml(l.provider)}</td>
                <td>${RESULT_LABELS[l.result] || escapeHtml(l.result)}</td>
                <td>${l.durationMs ? l.durationMs + ' мс' : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    loadLogs();
  },
};
