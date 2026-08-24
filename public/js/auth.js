if (Auth.isLoggedIn()) {
  location.href = '/app.html';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  const login = document.getElementById('login').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('POST', '/api/auth/login', { login, password });
    Auth.setSession(data.token, data.user);
    location.href = '/app.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
