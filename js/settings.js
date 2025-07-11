import { auth, db, getCurrentUser } from './auth.js';

const KEY = 'hiddenTabs';

export async function loadHiddenTabs() {
  const user = getCurrentUser?.();
  if (!user) {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  }
  const snap = await db
    .collection('users').doc(user.uid)
    .collection('settings').doc(KEY)
    .get();
  return snap.exists && Array.isArray(snap.data().tabs) ? snap.data().tabs : [];
}

export async function saveHiddenTabs(tabs) {
  const arr = Array.isArray(tabs) ? tabs : [];
  const user = getCurrentUser?.();
  if (!user) {
    localStorage.setItem(KEY, JSON.stringify(arr));
    return;
  }
  await db
    .collection('users').doc(user.uid)
    .collection('settings').doc(KEY)
    .set({ tabs: arr }, { merge: true });
}

export function applyHiddenTabs(tabs) {
  const buttons = document.querySelectorAll('.tab-button');
  let active = document.querySelector('.tab-button.active');
  buttons.forEach(btn => {
    const target = btn.dataset.target;
    if (tabs.includes(target)) {
      btn.style.display = 'none';
      const panel = document.getElementById(target);
      if (panel) panel.style.display = 'none';
      if (btn === active) active = null;
    } else {
      btn.style.display = '';
    }
  });
  if (!active) {
    const first = Array.from(buttons).find(b => b.style.display !== 'none');
    if (first) first.click();
  }
}

export function initSettings({ settingsBtn, settingsModal }) {
  if (!settingsBtn || !settingsModal) return;

  const listDiv = settingsModal.querySelector('#settingsTabsList');
  listDiv.classList.add('settings-list');
  const panels = ['goalsPanel','calendarPanel','dailyPanel','metricsPanel','listsPanel','travelPanel'];

  if (listDiv.children.length === 0) {
    panels.forEach(id => {
      const label = document.createElement('label');
      label.className = 'settings-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + id.replace('Panel','')));
      listDiv.appendChild(label);
    });
  }

  settingsBtn.addEventListener('click', async () => {
    const hidden = await loadHiddenTabs();
    listDiv.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.checked = !hidden.includes(cb.value);
    });
    settingsModal.style.display = 'flex';
  });

  const saveBtn = settingsModal.querySelector('#settingsSaveBtn');
  const cancelBtn = settingsModal.querySelector('#settingsCancelBtn');

  saveBtn?.addEventListener('click', async () => {
    const hidden = [];
    listDiv.querySelectorAll('input[type=checkbox]').forEach(cb => {
      if (!cb.checked) hidden.push(cb.value);
    });
    await saveHiddenTabs(hidden);
    applyHiddenTabs(hidden);
    settingsModal.style.display = 'none';
  });

  cancelBtn?.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  settingsModal.addEventListener('click', e => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
  });

  auth.onAuthStateChanged(async () => {
    const hidden = await loadHiddenTabs();
    applyHiddenTabs(hidden);
  });
}

export async function initSettingsPage() {
  const listDiv = document.getElementById('settingsTabsList');
  listDiv?.classList.add('settings-list');
  const saveBtn = document.getElementById('settingsSaveBtn');
  const emailSpan = document.getElementById('settingsEmail');
  const panels = ['goalsPanel','calendarPanel','dailyPanel','metricsPanel','listsPanel','travelPanel'];

  if (listDiv && listDiv.children.length === 0) {
    panels.forEach(id => {
      const label = document.createElement('label');
      label.className = 'settings-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + id.replace('Panel','')));
      listDiv.appendChild(label);
    });
  }

  const populate = async () => {
    const hidden = await loadHiddenTabs();
    listDiv.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.checked = !hidden.includes(cb.value);
    });
  };

  saveBtn?.addEventListener('click', async () => {
    const hidden = [];
    listDiv.querySelectorAll('input[type=checkbox]').forEach(cb => {
      if (!cb.checked) hidden.push(cb.value);
    });
    await saveHiddenTabs(hidden);
    window.location.href = 'index.html';
  });

  const updateForUser = async (user) => {
    if (emailSpan) emailSpan.textContent = user?.email || '';
    await populate();
  };

  auth.onAuthStateChanged(updateForUser);
  updateForUser(getCurrentUser?.());
}
