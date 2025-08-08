import { getCurrentUser, db } from './auth.js';
import { SAMPLE_DECISIONS, SAMPLE_LISTS } from './sampleData.js';

// Demo data for visitors stored in sampleData.js

function shiftSampleCalendarItems(items) {
  const today = new Date();
  const scheduled = items.filter(it => it.scheduled);
  if (!scheduled.length) return items;
  const dates = scheduled
    .map(it => new Date(it.scheduled))
    .filter(d => !isNaN(d));
  const earliest = dates.sort((a, b) => a - b)[0];
  if (!earliest || earliest >= today) return items;
  const shiftDays = Math.ceil((today - earliest) / 86400000) + 7;
  return items.map(it => {
    if (!it.scheduled) return it;
    const start = new Date(it.scheduled);
    if (isNaN(start)) return it;
    start.setDate(start.getDate() + shiftDays);
    const updated = { ...it, scheduled: start.toISOString().split('T')[0] };
    if (it.scheduledEnd) {
      const end = new Date(it.scheduledEnd);
      if (!isNaN(end)) {
        end.setDate(end.getDate() + shiftDays);
        updated.scheduledEnd = end.toISOString().split('T')[0];
      }
    }
    return updated;
  });
}

function stripScheduleFields(list) {
  return list.map(({ scheduled, scheduledEnd, ...rest }) => rest);
}

const SAMPLE_SIGNATURE = JSON.stringify(stripScheduleFields(SAMPLE_DECISIONS));

function isSampleDataset(items) {
  if (!Array.isArray(items) || items.length !== SAMPLE_DECISIONS.length) return false;
  try {
    return JSON.stringify(stripScheduleFields(items)) === SAMPLE_SIGNATURE;
  } catch {
    return false;
  }
}

// Cache decisions and goal order in memory only
let decisionsCache = null;
let goalOrderCache = null;
let saveTimer = null;

export function clearDecisionsCache() {
  decisionsCache = null;
}

export function clearGoalOrderCache() {
  goalOrderCache = null;
}

export function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

export async function loadDecisions(forceRefresh = false) {
  const currentUser = getCurrentUser();

  if (decisionsCache && !forceRefresh) {
    return decisionsCache;
  }

  if (!currentUser) {
    console.warn('🚫 No current user — returning sample data');
    decisionsCache = shiftSampleCalendarItems(SAMPLE_DECISIONS);
    return decisionsCache;
  }

  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  const rawItems = data && Array.isArray(data.items) ? data.items : [];

  const items = rawItems.map(it => {
    if (it && it.hiddenUntil && typeof it.hiddenUntil.toDate === 'function') {
      return { ...it, hiddenUntil: it.hiddenUntil.toDate().toISOString() };
    }
    return it;
  });

  decisionsCache = items;
  return decisionsCache;
}

export async function saveDecisions(items) {
  const currentUser = getCurrentUser();
  if (!Array.isArray(items)) return;
  // ensure at least one valid decision exists
  if (!items.some(i => i.id && i.text)) {
    console.warn('⚠️ Refusing to save empty or invalid decisions');
    return;
  }
  if (!currentUser) {
    if (isSampleDataset(items)) return;
    alert('⚠️ Please sign in to save your changes.');
    decisionsCache = items;
    return;
  }
  decisionsCache = items;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await db
        .collection('decisions')
        .doc(currentUser.uid)
        .set({ items }, { merge: true });
    } catch (err) {
      console.error('Failed to save decisions:', err);
      alert('⚠️ Failed to save changes.');
    }
  }, 200);
}

export async function loadGoalOrder(forceRefresh = false) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return [];
  }

  if (goalOrderCache && !forceRefresh) {
    return goalOrderCache;
  }

  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  goalOrderCache = Array.isArray(snap.data()?.goalOrder)
    ? snap.data().goalOrder
    : [];
  return goalOrderCache;
}

export async function flushPendingDecisions() {
  const currentUser = getCurrentUser();
  if (!currentUser || !saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    await db
      .collection('decisions')
      .doc(currentUser.uid)
      .set({ items: decisionsCache }, { merge: true });
  } catch (err) {
    console.error('Failed to save decisions:', err);
    alert('⚠️ Failed to save changes.');
  }
}

export async function restoreBackup(selectFn) {
  const backups = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('backup-')) backups.push(key);
  }
  if (backups.length === 0) {
    alert('No backups found');
    return null;
  }
  const choose = selectFn || ((keys) => {
    const msg = `Choose backup:\n${keys.join('\n')}`;
    return window.prompt(msg);
  });
  const chosen = choose(backups);
  if (!chosen || !backups.includes(chosen)) return null;
  let items;
  try {
    items = JSON.parse(localStorage.getItem(chosen));
  } catch {
    alert('Invalid backup data');
    return null;
  }
  if (!Array.isArray(items) || items.length === 0 || isSampleDataset(items)) {
    alert('⚠️ Refusing to restore empty or demo backup.');
    return null;
  }
  const dateStr = chosen.replace('backup-', '');
  const sizeKb = (JSON.stringify(items).length / 1024).toFixed(1);
  const msg = `Restore backup from ${dateStr} containing ${items.length} item${
    items.length === 1 ? '' : 's'
  } (~${sizeKb} KB)?`;
  const confirmFn = typeof globalThis.confirm === 'function' ? globalThis.confirm : () => true;
  if (!confirmFn(msg)) return null;
  const currentUser = getCurrentUser();
  if (!currentUser) {
    alert('⚠️ Please sign in to restore backup.');
    return null;
  }
  try {
    const docRef = db.collection('decisions').doc(currentUser.uid);
    const snap = await docRef.get();
    const prevItems = (snap.data && typeof snap.data === 'function' ? snap.data() : snap.data)?.items || [];
    await db
      .collection('restoreBackups')
      .doc(currentUser.uid)
      .set({ items: prevItems });
    await docRef.set({ items }, { merge: true });
    decisionsCache = items;
    return chosen;
  } catch (err) {
    console.error('Failed to restore backup:', err);
    alert('⚠️ Failed to restore backup.');
    return null;
  }
}

export async function saveGoalOrder(order) {
  const currentUser = getCurrentUser();
  if (!currentUser || !Array.isArray(order) || order.length === 0) {
    console.warn('⚠️ Refusing to save empty goalOrder');
    return;
  }

  try {
    await db
      .collection('decisions')
      .doc(currentUser.uid)
      .set({ goalOrder: order }, { merge: true });
    goalOrderCache = order;
  } catch (err) {
    console.error('Failed to save goal order:', err);
    alert('⚠️ Failed to save changes.');
  }
}

export function parseNaturalDate(input) {
  const today = new Date();
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const norm = input.trim().toLowerCase();
  if (norm === 'today') {
    return today.toISOString().split('T')[0];
  }
  const dow = weekdays.find(d => norm.startsWith(d));
  if (dow) {
    const target = weekdays.indexOf(dow);
    let delta = target - today.getDay();
    if (delta <= 0) delta += 7;
    const next = new Date(today);
    next.setDate(today.getDate() + delta);
    return next.toISOString().split('T')[0];
  }
  return null;
}

export function formatDaysUntil(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  // Parse as local date rather than UTC
  const target = new Date(dateStr + 'T00:00:00');
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  return `overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
}

/* lists support */
const LISTS_KEY = 'myLists';

export async function loadLists() {
  const user = getCurrentUser?.();
  if (!user) {
    const stored = JSON.parse(localStorage.getItem(LISTS_KEY) || 'null');
    if (Array.isArray(stored) && stored.length) {
      return stored; // anonymous → localStorage
    }
    return SAMPLE_LISTS.slice();
  }

  const doc = await db.collection('lists').doc(user.uid).get();
  if (doc.exists && Array.isArray(doc.data().lists)) {
    return doc.data().lists;                                   // Firestore copy exists
  }
  return [];
}

/* overwrite the old saveLists with this safer version */
export async function saveLists(lists) {
  // strip out any undefined values that Firestore rejects
  const sanitized = JSON.parse(JSON.stringify(lists ?? []));  // undefined → []

  const user = getCurrentUser?.();
  if (!user) {
    localStorage.setItem(LISTS_KEY, JSON.stringify(sanitized));
    return;
  }
  await db.collection('lists')
          .doc(user.uid)
          .set({ lists: sanitized }, { merge: true });
}

// Convert plain text containing URLs into clickable links
export function linkify(text = '') {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return escaped.replace(urlRegex,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

// Reusable icon-style button factory
export function makeIconBtn(symbol, title, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = symbol;
  b.title = title;
  Object.assign(b.style, {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1em',
    padding: '0'
  });
  b.addEventListener('mousedown', e => e.stopPropagation());
  b.addEventListener('click', e => e.stopPropagation());
  b.onclick = fn;
  return b;
}

export function pickDate(initial = '') {
  // Fallback for browsers lacking <dialog> support
  if (!window.HTMLDialogElement || !document.createElement('dialog').showModal) {
    const val = prompt('Select date (YYYY-MM-DD):', initial);
    return Promise.resolve(val ? val.trim() : '');
  }
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    const form = document.createElement('form');
    form.method = 'dialog';

    const input = document.createElement('input');
    input.type = 'date';
    input.value = initial;

    const ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.value = 'default';

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.value = 'cancel';

    const row = document.createElement('div');
    row.className = 'button-row';
    row.append(cancel, ok);

    form.append(input, row);
    dialog.append(form);
    document.body.appendChild(dialog);

    dialog.addEventListener('close', () => {
      const val = dialog.returnValue === 'cancel' ? '' : input.value;
      dialog.remove();
      resolve(val);
    });

    dialog.showModal();
    input.focus();
    input.showPicker?.();
  });
}

export function pickDateRange(start = '', end = '') {
  // Fallback for browsers lacking <dialog> support
  if (!window.HTMLDialogElement || !document.createElement('dialog').showModal) {
    const startVal = prompt('Start date (YYYY-MM-DD):', start) || '';
    if (!startVal) return Promise.resolve({ start: null, end: null });
    const endVal = prompt('End date (optional):', end) || '';
    return Promise.resolve({ start: startVal.trim(), end: endVal.trim() });
  }
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    const form = document.createElement('form');
    form.method = 'dialog';

    const startInput = document.createElement('input');
    startInput.type = 'date';
    startInput.value = start;

    const endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.value = end;
    endInput.style.marginLeft = '8px';

    const ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.value = 'default';

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.value = 'cancel';

    const row = document.createElement('div');
    row.className = 'button-row';
    row.append(cancel, ok);

    form.append(startInput, endInput, row);
    dialog.append(form);
    document.body.appendChild(dialog);

    dialog.addEventListener('close', () => {
      const cancelled = dialog.returnValue === 'cancel';
      const result = {
        start: cancelled ? null : startInput.value,
        end: cancelled ? null : endInput.value
      };
      dialog.remove();
      resolve(result);
    });

    dialog.showModal();
    startInput.focus();
    startInput.showPicker?.();
  });
}



