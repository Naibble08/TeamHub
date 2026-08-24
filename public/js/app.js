if (!Auth.isLoggedIn()) {
  location.href = '/login.html';
}

const user = Auth.getUser();
const isAdmin = user?.role === 'admin';

document.getElementById('user-name').textContent = `${user.firstName} ${user.lastName}`;
document.getElementById('user-role').textContent = isAdmin ? 'Администратор' : (user.position || 'Сотрудник');

document.querySelectorAll('[data-admin-only]').forEach((el) => {
  if (!isAdmin) el.remove();
});

document.getElementById('logout-btn').addEventListener('click', () => {
  window.ChatSocket?.disconnect();
  Auth.clear();
  location.href = '/login.html';
});

document.getElementById('change-password-btn').addEventListener('click', () => {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>Смена пароля</h3>
      <div class="field"><label>Текущий пароль</label><input type="password" id="cp-old" /></div>
      <div class="field"><label>Новый пароль</label><input type="password" id="cp-new" /></div>
      <div class="error-msg" id="cp-error"></div>
      <div class="modal-actions">
        <button class="btn" id="cp-cancel">Отмена</button>
        <button class="btn btn-primary" id="cp-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#cp-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#cp-save').onclick = async () => {
    const oldPassword = backdrop.querySelector('#cp-old').value;
    const newPassword = backdrop.querySelector('#cp-new').value;
    try {
      await api('POST', '/api/auth/change-password', { oldPassword, newPassword });
      backdrop.remove();
      showToast('Пароль изменён');
    } catch (err) {
      backdrop.querySelector('#cp-error').textContent = err.message;
    }
  };
});

const routes = {
  tasks: () => window.TasksView.render(view),
  chat: () => window.ChatView.render(view),
  documents: () => window.DocumentsView.render(view),
  employees: () => window.EmployeesView.render(view),
  settings: () => window.SettingsView.render(view),
};

const view = document.getElementById('view');

function navigate() {
  const route = (location.hash || '#tasks').slice(1);
  const handler = routes[route] || routes.tasks;

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.route === route);
  });

  view.innerHTML = '';
  handler();
}

document.querySelectorAll('.nav-item').forEach((el) => {
  el.addEventListener('click', () => { location.hash = el.dataset.route; });
});

window.addEventListener('hashchange', navigate);

window.ChatSocket = io({ auth: { token: Auth.getToken() } });
window.ChatSocket.on('connect_error', (err) => {
  console.warn('Ошибка подключения чата:', err.message);
});

navigate();
