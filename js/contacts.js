let contacts = [];

function loadContacts() {
  try {
    contacts = JSON.parse(localStorage.getItem('contacts')) || [];
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
  contacts.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    list.appendChild(li);
  });
}

export function addContact(name) {
  if (!name) return;
  contacts.push(name);
  saveContacts();
  renderContacts();
}

export function initContactsPanel() {
  loadContacts();
  renderContacts();
}

window.initContactsPanel = initContactsPanel;
window.addContact = addContact;
