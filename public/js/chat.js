window.ChatView = {
  async render(container) {
    const user = Auth.getUser();
    const users = (await api('GET', '/api/users')).filter((u) => u.id !== user.id);

    container.innerHTML = `
      <h2>Чат</h2>
      <div class="chat-layout">
        <div class="chat-contacts">
          <div class="chat-contact active" data-peer="general">💬 Общий чат</div>
          <div class="chat-contact" data-peer="system">🔔 Уведомления</div>
          ${users.map((u) => `<div class="chat-contact" data-peer="${u.id}">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</div>`).join('')}
        </div>
        <div class="chat-main">
          <div class="chat-header" id="chat-title">Общий чат</div>
          <div class="chat-messages" id="chat-messages"></div>
          <div class="ai-panel" id="ai-panel">
            <div class="row">
              <input id="ai-instruction" placeholder="Опишите, о чём должно быть сообщение…" />
              <button class="btn btn-sm" id="ai-generate-btn">Сгенерировать</button>
            </div>
            <div id="ai-draft-wrap"></div>
          </div>
          <div class="chat-input-row">
            <button class="btn btn-sm" id="ai-toggle-btn" title="ИИ-ассистент">🤖</button>
            <textarea id="chat-input" placeholder="Сообщение…"></textarea>
            <button class="btn btn-primary btn-sm" id="chat-send-btn">Отправить</button>
          </div>
        </div>
      </div>
    `;

    let currentPeer = 'general';
    const messagesEl = container.querySelector('#chat-messages');
    const titleEl = container.querySelector('#chat-title');

    function renderMessages(list) {
      if (list.length === 0) {
        messagesEl.innerHTML = '<div class="empty-state">Сообщений пока нет</div>';
        return;
      }
      messagesEl.innerHTML = list.map((m) => messageHtml(m, user)).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function historyUrl(peer) {
      if (peer === 'general') return '/api/messages/general';
      if (peer === 'system') return '/api/messages/system';
      return `/api/messages/with/${peer}`;
    }

    async function loadHistory(peer) {
      const list = await api('GET', historyUrl(peer));
      renderMessages(list);
    }

    function belongsToCurrentView(m) {
      if (currentPeer === 'general') return m.recipientId === null;
      if (currentPeer === 'system') return m.senderId === null && m.recipientId === user.id;
      const peer = Number(currentPeer);
      return (m.senderId === user.id && m.recipientId === peer) ||
             (m.senderId === peer && m.recipientId === user.id);
    }

    window.ChatSocket.off('chat:message');
    window.ChatSocket.on('chat:message', (m) => {
      if (belongsToCurrentView(m)) {
        if (messagesEl.querySelector('.empty-state')) messagesEl.innerHTML = '';
        messagesEl.insertAdjacentHTML('beforeend', messageHtml(m, user));
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else {
        showToast('Новое сообщение');
      }
    });

    const inputRow = container.querySelector('.chat-input-row');

    container.querySelectorAll('.chat-contact').forEach((el) => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.chat-contact').forEach((c) => c.classList.remove('active'));
        el.classList.add('active');
        currentPeer = el.dataset.peer;
        titleEl.textContent = el.textContent;
        inputRow.style.display = currentPeer === 'system' ? 'none' : 'flex';
        loadHistory(currentPeer);
      });
    });

    const input = container.querySelector('#chat-input');
    function send(content, aiMeta) {
      if (!content.trim() || currentPeer === 'system') return;
      const toUserId = currentPeer === 'general' ? null : Number(currentPeer);
      window.ChatSocket.emit('chat:send', {
        toUserId,
        content,
        isLlmGenerated: !!aiMeta,
        llmProvider: aiMeta?.provider,
      }, (res) => {
        if (res?.error) showToast(res.error);
      });
    }

    container.querySelector('#chat-send-btn').addEventListener('click', () => {
      send(input.value);
      input.value = '';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send(input.value);
        input.value = '';
      }
    });

    const aiPanel = container.querySelector('#ai-panel');
    container.querySelector('#ai-toggle-btn').addEventListener('click', () => {
      aiPanel.classList.toggle('open');
    });

    container.querySelector('#ai-generate-btn').addEventListener('click', () => {
      const instruction = container.querySelector('#ai-instruction').value.trim();
      if (!instruction) return;
      const draftWrap = container.querySelector('#ai-draft-wrap');
      draftWrap.innerHTML = '<div class="empty-state">Генерация…</div>';

      window.ChatSocket.emit('chat:ai-generate', { instruction }, (res) => {
        if (res?.error) {
          draftWrap.innerHTML = `<div class="empty-state">${escapeHtml(res.error)}</div>`;
          return;
        }
        draftWrap.innerHTML = `
          <div class="ai-draft">${escapeHtml(res.text)}</div>
          <div class="modal-actions">
            <button class="btn btn-sm" id="ai-edit-btn">В поле ввода</button>
            <button class="btn btn-primary btn-sm" id="ai-send-btn">Отправить как есть</button>
          </div>
        `;
        draftWrap.querySelector('#ai-edit-btn').onclick = () => {
          input.value = res.text;
          aiPanel.classList.remove('open');
        };
        draftWrap.querySelector('#ai-send-btn').onclick = () => {
          send(res.text, res);
          aiPanel.classList.remove('open');
          draftWrap.innerHTML = '';
          container.querySelector('#ai-instruction').value = '';
        };
      });
    });

    loadHistory(currentPeer);
  },
};

function messageHtml(m, user) {
  const mine = m.senderId === user.id;
  const aiTag = m.isLlmGenerated ? `<span class="ai-tag">🤖 сгенерировано ИИ</span>` : '';
  return `
    <div class="msg ${mine ? 'mine' : ''} ${m.isLlmGenerated ? 'ai' : ''}">
      <div class="meta">
        <span>${escapeHtml(m.senderName)}</span>
        <span>${formatDateTime(m.createdAt)}</span>
        ${aiTag}
      </div>
      <div class="content">${escapeHtml(m.content)}</div>
    </div>
  `;
}
