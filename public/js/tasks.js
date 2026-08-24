const STATUS_LABELS = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  overdue: 'Просрочена',
};

window.TasksView = {
  async render(container) {
    const user = Auth.getUser();
    const isAdmin = user.role === 'admin';
    let scope = 'my';

    container.innerHTML = `
      <h2>Задачи</h2>
      <div class="toolbar">
        ${isAdmin ? `
          <button class="btn btn-sm" id="scope-my">Мои задачи</button>
          <button class="btn btn-sm" id="scope-all">Все задачи</button>
        ` : ''}
        ${isAdmin ? '<button class="btn btn-primary btn-sm" id="new-task-btn" style="margin-left:auto;">+ Новая задача</button>' : ''}
      </div>
      <div id="tasks-list"></div>
    `;

    const listEl = container.querySelector('#tasks-list');

    async function load() {
      listEl.innerHTML = '<div class="empty-state">Загрузка…</div>';
      try {
        const tasks = await api('GET', `/api/tasks?scope=${scope}`);
        renderList(tasks);
      } catch (err) {
        listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
      }
    }

    function renderList(tasks) {
      if (tasks.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Задач нет</div>';
        return;
      }
      listEl.innerHTML = tasks.map((t) => taskCard(t, user, isAdmin)).join('');

      listEl.querySelectorAll('[data-status-select]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          try {
            await api('POST', `/api/tasks/${sel.dataset.statusSelect}/status`, { status: sel.value });
            showToast('Статус обновлён');
            load();
          } catch (err) {
            showToast(err.message);
          }
        });
      });
    }

    if (isAdmin) {
      container.querySelector('#scope-my').addEventListener('click', () => { scope = 'my'; load(); });
      container.querySelector('#scope-all').addEventListener('click', () => { scope = 'all'; load(); });
      container.querySelector('#new-task-btn').addEventListener('click', () => openTaskModal(load));
    }

    load();
  },
};

function taskCard(t, user, isAdmin) {
  const canChange =
    isAdmin || t.creatorId === user.id || t.assignees.some((a) => a.id === user.id);
  const assigneeNames = t.assignees.map((a) => `${a.firstName} ${a.lastName}`).join(', ') || '—';

  const statusOptions = ['new', 'in_progress', 'done']
    .map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`)
    .join('');

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <strong>${escapeHtml(t.title)}</strong>
          <div style="color:var(--text-muted); font-size:13px; margin-top:4px;">${escapeHtml(t.description || '')}</div>
        </div>
        <span class="badge ${t.status}">${STATUS_LABELS[t.status] || t.status}</span>
      </div>
      <div style="margin-top:10px; font-size:13px; color:var(--text-muted);">
        Срок: ${formatDueDate(t.dueDate)} · Исполнители: ${escapeHtml(assigneeNames)}
      </div>
      ${canChange && t.status !== 'overdue' ? `
        <div style="margin-top:10px;">
          <select data-status-select="${t.id}">${statusOptions}</select>
        </div>` : ''}
      ${canChange && t.status === 'overdue' ? `
        <div style="margin-top:10px;">
          <select data-status-select="${t.id}">
            <option value="overdue" selected>Просрочена</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнена</option>
          </select>
        </div>` : ''}
    </div>
  `;
}

async function openTaskModal(onSaved) {
  const employees = await api('GET', '/api/users');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>Новая задача</h3>
      <div class="field"><label>Название</label><input id="t-title" /></div>
      <div class="field"><label>Описание</label><textarea id="t-desc"></textarea></div>
      <div class="field"><label>Срок выполнения</label><input id="t-due" type="datetime-local" /></div>
      <div class="field">
        <label>Исполнители</label>
        <div class="checkbox-list">
          ${employees.map((e) => `
            <label><input type="checkbox" value="${e.id}" /> ${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</label>
          `).join('')}
        </div>
      </div>
      <div class="error-msg" id="t-error"></div>
      <div class="modal-actions">
        <button class="btn" id="t-cancel">Отмена</button>
        <button class="btn btn-primary" id="t-save">Создать</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#t-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#t-save').onclick = async () => {
    const title = backdrop.querySelector('#t-title').value.trim();
    const description = backdrop.querySelector('#t-desc').value.trim();
    const dueDate = backdrop.querySelector('#t-due').value;
    const assigneeIds = [...backdrop.querySelectorAll('.checkbox-list input:checked')].map((i) => Number(i.value));

    try {
      await api('POST', '/api/tasks', { title, description, dueDate, assigneeIds });
      backdrop.remove();
      showToast('Задача создана');
      onSaved();
    } catch (err) {
      backdrop.querySelector('#t-error').textContent = err.message;
    }
  };
}
