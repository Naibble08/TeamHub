window.DocumentsView = {
  async render(container) {
    const users = await api('GET', '/api/users');

    container.innerHTML = `
      <h2>Документы</h2>
      <div class="card">
        <form id="upload-form">
          <div class="toolbar">
            <input type="file" id="doc-file" required />
            <select id="doc-recipient">
              <option value="">Все сотрудники</option>
              ${users.map((u) => `<option value="${u.id}">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" type="submit">Загрузить</button>
          </div>
        </form>
      </div>
      <div id="docs-list"></div>
    `;

    const listEl = container.querySelector('#docs-list');

    async function load() {
      listEl.innerHTML = '<div class="empty-state">Загрузка…</div>';
      const docs = await api('GET', '/api/documents');
      if (docs.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Документов пока нет</div>';
        return;
      }
      listEl.innerHTML = `
        <table>
          <thead><tr><th>Файл</th><th>Получатель</th><th>Загрузил</th><th>Дата</th><th></th></tr></thead>
          <tbody>
            ${docs.map((d) => `
              <tr>
                <td>${escapeHtml(d.originalName)}</td>
                <td>${d.recipientName ? escapeHtml(d.recipientName) : 'Все сотрудники'}</td>
                <td>${escapeHtml(d.uploaderName || '')}</td>
                <td>${formatDateTime(d.uploadedAt)}</td>
                <td><a class="btn btn-sm" href="/api/documents/${d.id}/download" data-download="${d.id}">Скачать</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      listEl.querySelectorAll('[data-download]').forEach((a) => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          const resp = await fetch(`/api/documents/${a.dataset.download}/download`, {
            headers: { Authorization: `Bearer ${Auth.getToken()}` },
          });
          if (!resp.ok) { showToast('Не удалось скачать файл'); return; }
          const blob = await resp.blob();
          const disposition = resp.headers.get('Content-Disposition') || '';
          const match = disposition.match(/filename="?([^"]+)"?/);
          const filename = match ? match[1] : 'file';
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
        });
      });
    }

    container.querySelector('#upload-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = container.querySelector('#doc-file');
      const recipientId = container.querySelector('#doc-recipient').value;
      if (!fileInput.files[0]) return;

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      if (recipientId) formData.append('recipientId', recipientId);

      try {
        await apiUpload('/api/documents', formData);
        showToast('Файл загружен');
        fileInput.value = '';
        load();
      } catch (err) {
        showToast(err.message);
      }
    });

    load();
  },
};
