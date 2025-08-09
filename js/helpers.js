import { getCurrentUser, auth, db, awaitAuthUser } from './auth.js';
import { SAMPLE_DECISIONS, SAMPLE_LISTS } from './sampleData.js';
import {
  getDecisionsCache,
  setDecisionsCache,
  clearDecisionsCache,
  getGoalOrderCache,
  setGoalOrderCache,
  clearGoalOrderCache
} from './cache.js';

export { clearDecisionsCache, clearGoalOrderCache } from './cache.js';

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
const SAMPLE_LISTS_SIGNATURE = JSON.stringify(SAMPLE_LISTS);

// IDs used in sample/demo data that should never be persisted
const DEMO_IDS = new Set([
  'daily-task-1',
  'daily-task-2',
  'daily-task-3',
  'daily-task-4',
  'daily-task-5',
  'daily-task-6',
  'daily-task-7',
  'daily-task-8',
  'daily-task-9',
  'daily-task-10',
  'daily-task-11',
  'sample-decision-1'
]);

export function containsDemoItems(items) {
  if (!Array.isArray(items)) return false;
  return items.some(it => {
    const id = it && it.id;
    return typeof id === 'string' && (id.startsWith('demo-') || DEMO_IDS.has(id));
  });
}

function stripDemoItems(items) {
  if (!Array.isArray(items)) return items;
  return items.filter(it => {
    const id = it && it.id;
    return !(typeof id === 'string' && (id.startsWith('demo-') || DEMO_IDS.has(id)));
  });
}

function isSampleDataset(items) {
  if (!Array.isArray(items) || items.length !== SAMPLE_DECISIONS.length) return false;
  try {
    return JSON.stringify(stripScheduleFields(items)) === SAMPLE_SIGNATURE;
  } catch {
    return false;
  }
}

function dedupeById(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter(it => {
    if (!it?.id || seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
}


// Cache decisions and goal order in memory only
let saveTimer = null;
let pendingDecisions = null;

// If a save was attempted before login completed, retry once a user appears
auth.onAuthStateChanged(user => {
  if (user && pendingDecisions) {
    let items = pendingDecisions;
    pendingDecisions = null;
    if (containsDemoItems(items)) {
      items = stripDemoItems(items);
      if (!items.length) return;
    }
    if (isSampleDataset(items)) return;
    scheduleSave(user, items);
  }
});

function notifyDecisionsUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('decisionsUpdated'));
  }
}

function scheduleSave(user, items) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      let authUser = getCurrentUser();
      if (!authUser) authUser = await awaitAuthUser();
      if (!authUser) {
        console.warn('🛑 Cannot save decisions: no authenticated user');
        return;
      }
      let toSave = items;
      if (containsDemoItems(toSave)) {
        toSave = stripDemoItems(toSave);
      }
      if (!toSave.length || isSampleDataset(toSave)) return;
      await db
        .collection('decisions')
        .doc(authUser.uid)
        .set({ items: toSave }, { merge: true });
    } catch (err) {
      if (err?.code === 'permission-denied') {
        console.error('Save rejected by security rules:', err);
      } else {
        console.error('Failed to save decisions:', err);
      }
      alert('⚠️ Failed to save changes.');
    }
  }, 200);
}

export function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

export async function loadDecisions(forceRefresh = false) {
  await awaitAuthUser();
  const currentUser = getCurrentUser();

  const cached = getDecisionsCache();
  if (cached && !forceRefresh) {
    return cached;
  }

  if (!currentUser) {
    console.warn('🚫 No current user — returning sample data');
    const shifted = shiftSampleCalendarItems(SAMPLE_DECISIONS);
    setDecisionsCache(shifted);
    notifyDecisionsUpdated();
    return shifted;
  }

  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  const rawItems = data && Array.isArray(data.items) ? data.items : [];

  let items = rawItems.map(it => {
    if (it && it.hiddenUntil && typeof it.hiddenUntil.toDate === 'function') {
      return { ...it, hiddenUntil: it.hiddenUntil.toDate().toISOString() };
    }
    return it;
  });

  // Remove any duplicate decisions by id
  items = dedupeById(items);

  if (isSampleDataset(items)) {
    console.warn('⚠️ Ignoring sample decisions fetched from Firestore');
    items = [];
  }

  setDecisionsCache(items);
  notifyDecisionsUpdated();
  return getDecisionsCache();
}

export async function saveDecisions(items) {
  if (!Array.isArray(items)) return;
  // Remove duplicate IDs before caching/saving
  items = dedupeById(items);
  // ensure at least one valid decision exists
  if (!items.some(i => i.id && i.text)) {
    console.warn('⚠️ Refusing to save empty or invalid decisions');
    return;
  }
  if (containsDemoItems(items)) {
    items = stripDemoItems(items);
    if (!items.length) return;
  }

  setDecisionsCache(items);
  notifyDecisionsUpdated();
  let user = getCurrentUser();
  if (!user) {
    if (isSampleDataset(items)) return;
    pendingDecisions = items;
    user = await awaitAuthUser();
    if (!user) {
      pendingDecisions = null;
      console.warn('🛑 Cannot save decisions: no authenticated user');
      alert('⚠️ Please sign in to save your changes.');
      return;
    }
  }

  pendingDecisions = null;
  if (isSampleDataset(items)) return;
  scheduleSave(user, items);
}

export async function loadGoalOrder(forceRefresh = false) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return [];
  }

  const cached = getGoalOrderCache();
  if (cached && !forceRefresh) {
    return cached;
  }

  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const order = Array.isArray(snap.data()?.goalOrder)
    ? snap.data().goalOrder
    : [];
  setGoalOrderCache(order);
  return order;
}

export async function flushPendingDecisions() {
  if (!saveTimer) return;
  let user = getCurrentUser();
  if (!user) user = await awaitAuthUser();
  if (!user) {
    console.warn('🛑 Cannot flush decisions: no authenticated user');
    return;
  }
  let items = getDecisionsCache();
  if (containsDemoItems(items)) {
    items = stripDemoItems(items);
    if (!items.length) {
      clearTimeout(saveTimer);
      saveTimer = null;
      return;
    }
    setDecisionsCache(items);
  }
  if (isSampleDataset(items)) {
    clearTimeout(saveTimer);
    saveTimer = null;
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    await db
      .collection('decisions')
      .doc(user.uid)
      .set({ items }, { merge: true });
  } catch (err) {
    if (err?.code === 'permission-denied') {
      console.error('Save rejected by security rules:', err);
    } else {
      console.error('Failed to save decisions:', err);
    }
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
  if (containsDemoItems(items)) {
    items = stripDemoItems(items);
    if (!items.length) {
      alert('⚠️ Refusing to restore empty or demo backup.');
      return null;
    }
  }
  const dateStr = chosen.replace('backup-', '');
  const sizeKb = (JSON.stringify(items).length / 1024).toFixed(1);
  const msg = `Restore backup from ${dateStr} containing ${items.length} item${
    items.length === 1 ? '' : 's'
  } (~${sizeKb} KB)?`;
  const confirmFn = typeof globalThis.confirm === 'function' ? globalThis.confirm : () => true;
  if (!confirmFn(msg)) return null;
  let currentUser = getCurrentUser();
  if (!currentUser) {
    currentUser = await awaitAuthUser();
    if (!currentUser) {
      alert('⚠️ Please sign in to restore backup.');
      return null;
    }
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
    setDecisionsCache(items);
    return chosen;
  } catch (err) {
    if (err?.code === 'permission-denied') {
      console.error('Restore rejected by security rules:', err);
    } else {
      console.error('Failed to restore backup:', err);
    }
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
    setGoalOrderCache(order);
  } catch (err) {
    if (err?.code === 'permission-denied') {
      console.error('Save goal order rejected by security rules:', err);
    } else {
      console.error('Failed to save goal order:', err);
    }
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
  if (JSON.stringify(sanitized) === SAMPLE_LISTS_SIGNATURE) {
    console.warn('⚠️ Refusing to save sample lists');
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



