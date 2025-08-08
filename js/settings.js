import { auth, db, getCurrentUser } from './auth.js';
import { PANELS, PANEL_NAMES } from './tabs.js';

const KEY = 'hiddenTabs';

function normalize(data) {
  if (!data) return {};
  if (Array.isArray(data)) {
    const obj = {};
    data.forEach(id => {
      obj[id] = new Date('9999-12-31').toISOString();
    });
    return obj;
  }
  return typeof data === 'object' ? data : {};
}

export async function loadHiddenTabs() {
  const user = getCurrentUser?.();
  if (!user) {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (err) {
      console.error('Failed to parse hidden tabs from localStorage:', err);
      stored = {};
    }
    return normalize(stored);
  }
  const snap = await db
    .collection('users').doc(user.uid)
    .collection('settings').doc(KEY)
    .get();
  return snap.exists ? normalize(snap.data().tabs) : {};
}

export async function saveHiddenTabs(tabs) {
  const obj = normalize(tabs);
  const user = getCurrentUser?.();
  if (!user) {
    localStorage.setItem(KEY, JSON.stringify(obj));
    return;
  }
  await db
    .collection('users').doc(user.uid)
    .collection('settings').doc(KEY)
    .set({ tabs: obj }, { merge: true });
}

export async function clearHiddenTabs() {
  const user = getCurrentUser?.();
  if (!user) {
    localStorage.removeItem(KEY);
    return;
  }
  try {
    await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(KEY)
      .delete();
  } catch (err) {
    alert(`Failed to clear hidden tabs: ${err?.message || err}`);
    throw err;
  }
}

export function applyHiddenTabs(tabs) {
  const obj = normalize(tabs);
  const buttons = document.querySelectorAll('.tab-button');
  let active = document.querySelector('.tab-button.active');
  const now = Date.now();
  let changed = false;
  buttons.forEach(btn => {
    const target = btn.dataset.target;
    const panel = document.getElementById(target);
    const until = obj[target];
    const hideUntil = until ? Date.parse(until) || 0 : 0;
    if (hideUntil && now < hideUntil) {
      btn.style.display = 'none';
      if (panel) panel.style.display = 'none';
      if (btn === active) active = null;
    } else {
      if (until && hideUntil && now >= hideUntil) {
        delete obj[target];
        changed = true;
      }
      btn.style.display = '';
      if (panel) panel.style.display = btn === active ? 'flex' : 'none';
    }
  });
  if (!active) {
    const first = Array.from(buttons).find(b => b.style.display !== 'none');
    if (first) first.click();
  }
  if (changed) saveHiddenTabs(obj).catch(() => {});
}


export async function initSettingsPage() {
  const listDiv = document.getElementById('settingsTabsList');
  listDiv?.classList.add('settings-list');
  const saveBtn = document.getElementById('settingsSaveBtn');
  const resetBtn = document.getElementById('settingsResetBtn');
  const emailSpan = document.getElementById('settingsEmail');
  const panels = PANELS;

  if (listDiv && listDiv.children.length === 0) {
    panels.forEach(id => {
      const label = document.createElement('label');
      label.className = 'settings-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      label.appendChild(cb);
      const name = PANEL_NAMES[id] || id.replace('Panel','');
      label.appendChild(document.createTextNode(' ' + name));
      listDiv.appendChild(label);
    });
  }

  const populate = async () => {
    const hidden = await loadHiddenTabs();
    listDiv.querySelectorAll('.settings-option input[type=checkbox]').forEach(cb => {
      const until = hidden[cb.value];
      const hideUntil = until ? Date.parse(until) || 0 : 0;
      const hiddenNow = hideUntil && Date.now() < hideUntil;
      cb.checked = !hiddenNow;
    });
  };

  saveBtn?.addEventListener('click', async () => {
    const hidden = {};
    listDiv.querySelectorAll('.settings-option input[type=checkbox]').forEach(cb => {
      if (!cb.checked) {
        hidden[cb.value] = new Date('9999-12-31').toISOString();
      }
    });
    await saveHiddenTabs(hidden);
    window.location.href = 'index.html';
  });

  resetBtn?.addEventListener('click', async () => {
    try {
      await clearHiddenTabs();
    } catch (err) {
      // error already surfaced in clearHiddenTabs
    } finally {
      window.location.href = 'index.html';
    }
  });

  const updateForUser = async (user) => {
    if (emailSpan) emailSpan.textContent = user?.email || '';
    await populate();
  };

  auth.onAuthStateChanged(updateForUser);
  updateForUser(getCurrentUser?.());
}
