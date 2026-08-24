const TOKEN_KEY = 'teamhub_token';
const USER_KEY = 'teamhub_user';

const Auth = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn() { return !!this.getToken(); },
};

async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (resp.status === 401) {
    Auth.clear();
    if (!location.pathname.endsWith('login.html')) {
      location.href = '/login.html';
    }
    throw new Error('Требуется авторизация');
  }

  let data = null;
  const text = await resp.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!resp.ok) {
    throw new Error((data && data.error) || 'Ошибка запроса');
  }
  return data;
}

async function apiUpload(url, formData) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(url, { method: 'POST', headers, body: formData });
  const text = await resp.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!resp.ok) throw new Error((data && data.error) || 'Ошибка загрузки');
  return data;
}

function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// due_date хранится как введено пользователем (локальное время, без часового пояса) —
// в отличие от системных отметок времени (UTC из SQLite datetime('now')).
function formatDueDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
