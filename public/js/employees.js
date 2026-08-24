const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

window.EmployeesView = {
  async render(container) {
    container.innerHTML = `
      <h2>Сотрудники</h2>
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" id="new-emp-btn">+ Новый сотрудник</button>
      </div>
      <div id="emp-list"></div>
    `;

    async function load() {
      const list = await api('GET', '/api/users');
      const listEl = container.querySelector('#emp-list');
      listEl.innerHTML = `
        <table>
          <thead><tr><th>Сотрудник</th><th>Логин</th><th>Должность</th><th>Дата рождения</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            ${list.map((u) => `
              <tr>
                <td>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</td>
                <td>${escapeHtml(u.login)}</td>
                <td>${escapeHtml(u.position || '')}</td>
                <td>${u.birthDay ? `${u.birthDay} ${MONTHS[u.birthMonth - 1]}` : '—'}</td>
                <td><span class="badge ${u.role}">${u.role === 'admin' ? 'Администратор' : 'Сотрудник'}</span></td>
                <td>${u.isActive ? 'активен' : 'деактивирован'}</td>
                <td>
                  <button class="btn btn-sm" data-edit="${u.id}">Изменить</button>
                  ${u.isActive
                    ? `<button class="btn btn-sm btn-danger" data-deactivate="${u.id}">Деактивировать</button>`
                    : `<button class="btn btn-sm" data-activate="${u.id}">Активировать</button>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      listEl.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const u = list.find((x) => x.id === Number(btn.dataset.edit));
          openEmployeeModal(u, load);
        });
      });
      listEl.querySelectorAll('[data-deactivate]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api('POST', `/api/users/${btn.dataset.deactivate}/deactivate`);
          load();
        });
      });
      listEl.querySelectorAll('[data-activate]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api('POST', `/api/users/${btn.dataset.activate}/activate`);
          load();
        });
      });
    }

    container.querySelector('#new-emp-btn').addEventListener('click', () => openEmployeeModal(null, load));
    load();
  },
};

function openEmployeeModal(existing, onSaved) {
  const isEdit = !!existing;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>${isEdit ? 'Карточка сотрудника' : 'Новый сотрудник'}</h3>
      <div class="field"><label>Имя</label><input id="e-first" value="${isEdit ? escapeHtml(existing.firstName) : ''}" /></div>
      <div class="field"><label>Фамилия</label><input id="e-last" value="${isEdit ? escapeHtml(existing.lastName) : ''}" /></div>
      <div class="field"><label>Логин</label><input id="e-login" value="${isEdit ? escapeHtml(existing.login) : ''}" /></div>
      <div class="field"><label>${isEdit ? 'Новый пароль (необязательно)' : 'Пароль'}</label><input id="e-password" type="password" /></div>
      <div class="field"><label>Должность</label><input id="e-position" value="${isEdit ? escapeHtml(existing.position || '') : ''}" /></div>
      <div class="field" style="display:flex; gap:8px;">
        <div style="flex:1;"><label>День рождения (день)</label><input id="e-bday" type="number" min="1" max="31" value="${isEdit ? existing.birthDay || '' : ''}" /></div>
        <div style="flex:1;"><label>Месяц</label><input id="e-bmonth" type="number" min="1" max="12" value="${isEdit ? existing.birthMonth || '' : ''}" /></div>
      </div>
      <div class="field">
        <label>Роль</label>
        <select id="e-role">
          <option value="employee" ${isEdit && existing.role === 'employee' ? 'selected' : ''}>Сотрудник</option>
          <option value="admin" ${isEdit && existing.role === 'admin' ? 'selected' : ''}>Администратор</option>
        </select>
      </div>
      <div class="error-msg" id="e-error"></div>
      <div class="modal-actions">
        <button class="btn" id="e-cancel">Отмена</button>
        <button class="btn btn-primary" id="e-save">Сохранить</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#e-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#e-save').onclick = async () => {
    const payload = {
      firstName: backdrop.querySelector('#e-first').value.trim(),
      lastName: backdrop.querySelector('#e-last').value.trim(),
      login: backdrop.querySelector('#e-login').value.trim(),
      position: backdrop.querySelector('#e-position').value.trim(),
      birthDay: backdrop.querySelector('#e-bday').value ? Number(backdrop.querySelector('#e-bday').value) : null,
      birthMonth: backdrop.querySelector('#e-bmonth').value ? Number(backdrop.querySelector('#e-bmonth').value) : null,
      role: backdrop.querySelector('#e-role').value,
    };
    const password = backdrop.querySelector('#e-password').value;
    if (password) payload.password = password;

    try {
      if (isEdit) {
        await api('PUT', `/api/users/${existing.id}`, payload);
      } else {
        if (!password) throw new Error('Укажите пароль');
        await api('POST', '/api/users', payload);
      }
      backdrop.remove();
      showToast('Сохранено');
      onSaved();
    } catch (err) {
      backdrop.querySelector('#e-error').textContent = err.message;
    }
  };
}
