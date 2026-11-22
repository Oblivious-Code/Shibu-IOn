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

// ---------- Duck.ai Linker Engine ----------
function buildDuckAiUrl(userText) {
  const modifiers = [];
  if (imageMode) modifiers.push('Generate an image or visual concept for:');
  if (settings.tone !== 'Balanced') modifiers.push(`Tone: ${settings.tone}.`);
  if (settings.length !== 'Medium') modifiers.push(`Length: ${settings.length}.`);
  if (currentMode === 'Fast') modifiers.push('Keep the answer brief and direct.');
  if (settings.instructions) modifiers.push(settings.instructions);

  const finalPrompt = modifiers.length > 0
    ? `${userText}\n\n(${modifiers.join(' ')})`
    : userText;

  return `https://duckduckgo.com{encodeURIComponent(finalPrompt)}&ia=chat`;
}

function handleSend(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;

  // Create a chat session if starting fresh
  let chat = getCurrentChat();
  if (!chat) {
    chat = {
      id: Date.now().toString(),
      title: text.slice(0, 36) + (text.length > 36 ? '...' : ''),
      updatedAt: Date.now(),
      messages: []
    };
    chats.push(chat);
    currentChatId = chat.id;
    showChatView();
  }

  // Save & render user message
  chat.messages.push({ who: 'user', text });
  renderMessage(text, 'user');

  // Build the Duck.ai URL with your custom settings and open it
  const duckUrl = buildDuckAiUrl(text);
  window.open(duckUrl, '_blank', 'noopener,noreferrer');

  // Save & render confirmation bubble with a direct link
  const botText = `Sent your prompt to Duck.ai (${currentMode} mode, ${settings.tone} tone).`;
  chat.messages.push({ who: 'bot', text: botText, duckUrl });
  renderMessage(botText, 'bot', duckUrl);

  chat.updatedAt = Date.now();
  saveChats();
  renderRecent();

  inputEl.value = '';
  inputEl.style.height = 'auto';
  inputEl.focus();
}

// ---------- Wire Up Composers & Suggestion Chips ----------
function setupComposer(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);

  input.addEventListener('input', () => {
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
