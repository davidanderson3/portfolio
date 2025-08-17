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

export function renderContacts() {
  const list = document.getElementById('contactsList');
  if (!list) return;
  list.innerHTML = '';
  contacts.forEach((c, idx) => {
    const li = document.createElement('li');

    const nameText = document.createElement('span');
    nameText.textContent = c.name;
    nameText.style.display = 'none';

    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.value = c.name;
    nameInp.style.marginRight = '.5rem';

    const contactInp = document.createElement('input');
    contactInp.type = 'number';
    contactInp.placeholder = 'Contact days';
    contactInp.value = c.desiredContact ?? '';
    contactInp.style.width = '7rem';
    contactInp.style.marginRight = '.5rem';

    const convoInp = document.createElement('input');
    convoInp.type = 'number';
    convoInp.placeholder = 'Conversation days';
    convoInp.value = c.desiredConversation ?? '';
    convoInp.style.width = '7rem';
    convoInp.style.marginRight = '.5rem';

    const meetInp = document.createElement('input');
    meetInp.type = 'number';
    meetInp.placeholder = 'Meet days';
    meetInp.value = c.desiredMeet ?? '';
    meetInp.style.width = '7rem';
    meetInp.style.marginRight = '.5rem';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.marginRight = '.5rem';
    saveBtn.addEventListener('click', () => {
      c.name = nameInp.value.trim();
      c.desiredContact = contactInp.value ? Number(contactInp.value) : null;
      c.desiredConversation = convoInp.value ? Number(convoInp.value) : null;
      c.desiredMeet = meetInp.value ? Number(meetInp.value) : null;
      saveContacts();
      renderContacts();
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (!confirm('Delete contact?')) return;
      contacts.splice(idx, 1);
      saveContacts();
      renderContacts();
    });

    li.append(nameText, nameInp, contactInp, convoInp, meetInp, saveBtn, delBtn);

    const logRow = document.createElement('div');
    ['contact', 'conversation', 'meet', 'date'].forEach(type => {
      const btn = document.createElement('button');
      btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      btn.addEventListener('click', () => logContactEvent(c.name, type));
      logRow.appendChild(btn);
    });
    li.appendChild(logRow);

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
  saveContacts();
  renderContacts();
}

export function initContactsPanel() {
  loadContacts();
  renderContacts();

  const addBtn = document.getElementById('addContactBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const name = document.getElementById('newContactName').value.trim();
      const desiredContact = document.getElementById('newContactContact').value;
      const desiredConversation = document.getElementById('newContactConversation').value;
      const desiredMeet = document.getElementById('newContactMeet').value;
      addContact(name, {
        desiredContact,
        desiredConversation,
        desiredMeet
      });
      ['newContactName','newContactContact','newContactConversation','newContactMeet']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
    });
  }
}

window.initContactsPanel = initContactsPanel;
window.addContact = addContact;
window.logContactEvent = logContactEvent;
