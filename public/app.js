const sidebar = document.getElementById('sidebar');
const start = document.getElementById('start');
const messages = document.getElementById('messages');
const bottomDock = document.getElementById('bottomDock');
const stage = document.getElementById('stage');
const recentList = document.getElementById('recentList');

let currentMode = 'Reasonable';
let imageMode = false;
let settings = { tone: 'Balanced', length: 'Medium', instructions: '' };

try {
  const saved = JSON.parse(localStorage.getItem('duckai-settings') || 'null');
  if (saved) settings = { ...settings, ...saved };
} catch (e) {}

// ---------- Chat Storage ----------
const CHATS_KEY = 'duckai-chats';
let chats = [];
let currentChatId = null;

try {
  chats = JSON.parse(localStorage.getItem(CHATS_KEY) || '[]');
  if (!Array.isArray(chats)) chats = [];
} catch (e) { chats = []; }

function saveChats() {
  try { localStorage.setItem(CHATS_KEY, JSON.stringify(chats)); } catch (e) {}
}

function getCurrentChat() {
  return chats.find(c => c.id === currentChatId) || null;
}

function renderRecent() {
  recentList.innerHTML = '';
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  if (sorted.length === 0) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'No chats yet';
    recentList.appendChild(note);
    return;
  }
  sorted.forEach(chat => {
    const btn = document.createElement('button');
    btn.className = 'side-row' + (chat.id === currentChatId ? ' current' : '');
    btn.title = chat.title;
    const label = document.createElement('span');
    label.className = 'side-text';
    label.textContent = chat.title;
    btn.appendChild(label);
    btn.addEventListener('click', () => loadChat(chat.id));
    recentList.appendChild(btn);
  });
}

// ---------- View Helpers ----------
function showChatView() {
  start.classList.add('hidden');
  messages.classList.add('active');
  bottomDock.classList.add('active');
}

function showStartView() {
  messages.innerHTML = '';
  messages.classList.remove('active');
  bottomDock.classList.remove('active');
  start.classList.remove('hidden');
  document.getElementById('inputStart').value = '';
  document.getElementById('inputChat').value = '';
}

function renderMessage(text, who, duckUrl = null) {
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;

  // Add a clickable fallback button in case pop-ups are blocked
  if (duckUrl) {
    const br = document.createElement('br');
    const link = document.createElement('a');
    link.href = duckUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open in Duck.ai ↗';
    link.style.cssText = 'display:inline-block;margin-top:8px;padding:6px 14px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-size:13px;font-weight:600;';
    div.appendChild(br);
    div.appendChild(link);
  }

  messages.appendChild(div);
  stage.scrollTop = stage.scrollHeight;
  return div;
}

function loadChat(id) {
  const chat = chats.find(c => c.id === id);
  if (!chat) return;
  currentChatId = id;
  messages.innerHTML = '';
  chat.messages.forEach(m => renderMessage(m.text, m.who, m.duckUrl || null));
  showChatView();
  renderRecent();
  stage.scrollTop = stage.scrollHeight;
}

function startNewChat() {
  currentChatId = null;
  showStartView();
  renderRecent();
}

// ---------- Sidebar & Toolbar ----------
document.getElementById('toggleSidebar').addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

document.getElementById('newChat').addEventListener('click', startNewChat);

document.getElementById('deleteChat').addEventListener('click', () => {
  const chat = getCurrentChat();
  if (!chat) return;
  if (!confirm('Delete this chat?')) return;
  chats = chats.filter(c => c.id !== chat.id);
  saveChats();
  startNewChat();
});

// ---------- Mode Picker (Fast / Reasonable) ----------
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('[data-role="mode-label"]').forEach(l => l.textContent = mode);
  document.querySelectorAll('.mode-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.mode === mode);
  });
}

document.querySelectorAll('[data-role="mode-toggle"]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const menu = btn.parentElement.querySelector('[data-role="mode-menu"]');
    document.querySelectorAll('[data-role="mode-menu"]').forEach(m => {
      if (m !== menu) m.classList.remove('open');
    });
    menu.classList.toggle('open');
  });
});

document.querySelectorAll('.mode-option').forEach(opt => {
  opt.addEventListener('click', e => {
    e.stopPropagation();
    setMode(opt.dataset.mode);
    document.querySelectorAll('[data-role="mode-menu"]').forEach(m => m.classList.remove('open'));
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('[data-role="mode-menu"]').forEach(m => m.classList.remove('open'));
});

// ---------- Create Image Toggle ----------
function setImageMode(on) {
  imageMode = on;
  document.querySelectorAll('[data-action="image"]').forEach(b => b.classList.toggle('active', on));
  document.getElementById('inputStart').placeholder = on ? 'Describe the image you want' : 'Ask anything';
  document.getElementById('inputChat').placeholder = on ? 'Describe the image you want' : 'Ask a follow-up';
}

document.querySelectorAll('[data-action="image"]').forEach(btn => {
  btn.addEventListener('click', () => setImageMode(!imageMode));
});

// ---------- Customise Modal ----------
const overlay = document.getElementById('customiseOverlay');
const toneEl = document.getElementById('tone');
const lengthEl = document.getElementById('length');
const instructionsEl = document.getElementById('instructions');

function openCustomise() {
  toneEl.value = settings.tone;
  lengthEl.value = settings.length;
  instructionsEl.value = settings.instructions;
  overlay.classList.add('open');
}

document.querySelectorAll('[data-action="customise"]').forEach(btn => {
  btn.addEventListener('click', openCustomise);
});

document.getElementById('cancelCustomise').addEventListener('click', () => overlay.classList.remove('open'));
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

document.getElementById('saveCustomise').addEventListener('click', () => {
  settings = {
    tone: toneEl.value,
    length: lengthEl.value,
    instructions: instructionsEl.value.trim()
  };
  try { localStorage.setItem('duckai-settings', JSON.stringify(settings)); } catch (e) {}
  overlay.classList.remove('open');
});

// ---------- AI conversation ----------
let sending = false;

async function handleSend(inputEl, retryChat = null) {
  const text = retryChat ? retryChat.messages.filter(m => m.who === 'user').at(-1)?.text : inputEl.value.trim();
  if (!text || sending) return;
  if (text.length > 12000) {
    inputEl.setCustomValidity('Please keep your message under 12,000 characters.');
    inputEl.reportValidity();
    return;
  }
  inputEl.setCustomValidity('');
  let chat = retryChat || getCurrentChat();
  if (!chat) {
    chat = { id: crypto.randomUUID(), title: text.slice(0, 36), updatedAt: Date.now(), messages: [] };
    chats.push(chat);
    currentChatId = chat.id;
    showChatView();
  }
  if (retryChat) {
    if (chat.messages.at(-1)?.failed) chat.messages.pop();
    loadChat(chat.id);
  } else {
    chat.messages.push({ who: 'user', text });
    renderMessage(text, 'user');
  }
  const history = chat.messages.filter(m => !m.failed && !m.duckUrl && !m.text.startsWith('Sent to Duck.ai') && !m.text.startsWith('Opening Duck.ai'))
    .slice(-20).map(m => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text }));
  const reply = { who: 'bot', text: '' };
  const bubble = renderMessage('Thinking…', 'bot');
  bubble.setAttribute('role', 'status');
  sending = true;
  document.querySelectorAll('.send-btn, .chip').forEach(b => b.disabled = true);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  chat.updatedAt = Date.now();
  saveChats();
  renderRecent();
  const update = () => {
    if (currentChatId === chat.id && bubble.isConnected) {
      bubble.textContent = reply.text;
      stage.scrollTop = stage.scrollHeight;
    }
  };
  try {
    const response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, settings, mode: currentMode, imageMode }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || (response.status === 404 ? 'The chat service is unavailable. Please try again after the site finishes deploying.' : 'Unable to reach the AI. Please try again.'));
    }
    if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
      throw new Error('The chat service is unavailable. Please try again shortly.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '', done = false;
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.error) throw new Error(event.error);
        if (event.text) { reply.text += event.text; update(); }
        if (event.done) done = true;
      }
      if (chunk.done) break;
    }
    if (!done || !reply.text) throw new Error('The reply was interrupted. Please try again.');
  } catch (error) {
    reply.failed = true;
    reply.text = (reply.text ? reply.text + '\n\n' : '') +
      (error.name === 'TimeoutError' ? 'The AI took too long. Please try again.' : error.message || 'Connection lost. Please try again.');
    update();
  } finally {
    bubble.removeAttribute('role');
    chat.messages.push(reply);
    chat.updatedAt = Date.now();
    saveChats();
    renderRecent();
    sending = false;
    document.querySelectorAll('.send-btn, .chip').forEach(b => b.disabled = false);
    if (reply.failed && currentChatId === chat.id && bubble.isConnected) {
      const retry = document.createElement('button');
      retry.className = 'pill-btn';
      retry.textContent = 'Retry reply';
      retry.addEventListener('click', () => {
        if (!sending && chat.messages.at(-1) === reply) handleSend(document.getElementById('inputChat'), chat);
      });
      bubble.appendChild(retry);
    }
    if (currentChatId === chat.id) document.getElementById('inputChat').focus();
  }
}

// ---------- Wire Up Composers & Suggestion Chips ----------
function setupComposer(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);

  input.addEventListener('input', () => {
    input.setCustomValidity('');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  });

  btn.addEventListener('click', () => handleSend(input));
}

setupComposer('inputStart', 'sendStart');
setupComposer('inputChat', 'sendChat');

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const inputStart = document.getElementById('inputStart');
    inputStart.value = chip.dataset.prompt;
    handleSend(inputStart);
  });
});

// Initialize sidebar history on load
renderRecent();
