let contacts = [];

function loadContacts() {
  try {
    const stored = JSON.parse(localStorage.getItem('contacts')) || [];
    contacts = stored.map(c => {
      if (typeof c === 'string') return { name: c, logs: [] };
      return { ...c, logs: c.logs || [] };
    });
  } catch {
    contacts = [];
  }
}

function saveContacts() {
  try {
    localStorage.setItem('contacts', JSON.stringify(contacts));
  } catch {}
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'never';
}

export function renderContacts() {
  const list = document.getElementById('contactsList');
  if (!list) return;
  list.innerHTML = '';
  contacts.forEach(c => {
    const li = document.createElement('li');
    const nameEl = document.createElement('strong');
    nameEl.textContent = c.name;
    li.appendChild(nameEl);

    function addRow(label, prop, type, freqProp) {
      const row = document.createElement('div');
      const span = document.createElement('span');
      const freq = c[freqProp];
      span.textContent = `${label}: ${formatDate(c[prop])}${freq ? ` (every ${freq} days)` : ''}`;
      const btn = document.createElement('button');
      btn.textContent = 'Log';
      btn.addEventListener('click', () => logContactEvent(c.name, type));
      row.append(span, btn);
      li.appendChild(row);
    }

    addRow('Last contact', 'lastContact', 'contact', 'desiredContact');
    addRow('Last conversation', 'lastConversation', 'conversation', 'desiredConversation');
    addRow('Last meet', 'lastMeet', 'meet', 'desiredMeet');

    list.appendChild(li);
  });
}

export function addContact(name, prefs = {}) {
  if (!name) return;

  function getVal(key, msg) {
    if (prefs[key] !== undefined) return Number(prefs[key]) || null;
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const v = window.prompt(msg, '');
      return v ? Number(v) : null;
    }
    return null;
  }

  const contact = {
    name,
    desiredContact: getVal('desiredContact', 'Desired frequency of contact (days)'),
    desiredConversation: getVal('desiredConversation', 'Desired frequency of meaningful conversation (days)'),
    desiredMeet: getVal('desiredMeet', 'Desired frequency of in person get together (days)'),
    lastContact: null,
    lastConversation: null,
    lastMeet: null,
    logs: []
  };
  contacts.push(contact);
  saveContacts();
  renderContacts();
}

export function logContactEvent(name, type, note) {
  const c = contacts.find(c => c.name === name);
  if (!c) return;
  const now = new Date().toISOString();
  let noteVal = note;
  if (noteVal === undefined && typeof window !== 'undefined' && typeof window.prompt === 'function') {
    noteVal = window.prompt('Notes', '') || '';
  }
  c.logs = c.logs || [];
  c.logs.push({ type, date: now, note: noteVal || '' });
  if (type === 'contact') c.lastContact = now;
  if (type === 'conversation') c.lastConversation = now;
  if (type === 'meet') c.lastMeet = now;
  saveContacts();
  renderContacts();
}

export function initContactsPanel() {
  loadContacts();
  renderContacts();
}

window.initContactsPanel = initContactsPanel;
window.addContact = addContact;
window.logContactEvent = logContactEvent;
