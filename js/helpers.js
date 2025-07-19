import { getCurrentUser, db } from './auth.js';
import { SAMPLE_DECISIONS, SAMPLE_LISTS } from './sampleData.js';

// Demo data for visitors stored in sampleData.js

// Cache decisions in-memory to avoid repeated Firestore reads
let decisionsCache = null;
const DECISIONS_LOCAL_KEY = 'pendingDecisions';
let saveTimer = null;

export function clearDecisionsCache() {
  decisionsCache = null;
}

export function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

export async function loadDecisions(forceRefresh = false) {
  if (decisionsCache && !forceRefresh) {
    return decisionsCache;
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.warn('🚫 No current user — returning sample data');
    return SAMPLE_DECISIONS;
  }

  const pending = localStorage.getItem(DECISIONS_LOCAL_KEY);
  if (pending) {
    try {
      const items = JSON.parse(pending);
      await db
        .collection('decisions')
        .doc(currentUser.uid)
        .set({ items }, { merge: true });
      localStorage.removeItem(DECISIONS_LOCAL_KEY);
      decisionsCache = items;
      return decisionsCache;
    } catch (err) {
      console.warn('Failed to sync pending decisions:', err);
      try {
        decisionsCache = JSON.parse(pending);
        return decisionsCache;
      } catch {
        // fall through to fetching from Firestore
      }
    }
  }
  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  const rawItems = data && Array.isArray(data.items) ? data.items : [];
  decisionsCache = rawItems.map(it => {
    if (it && it.hiddenUntil && typeof it.hiddenUntil.toDate === 'function') {
      return { ...it, hiddenUntil: it.hiddenUntil.toDate().toISOString() };
    }
    return it;
  });
  return decisionsCache;
}

export async function saveDecisions(items) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    alert('⚠️ Please sign in to save your changes.');
    return;
  }
  if (!Array.isArray(items)) return;
  // ensure at least one valid decision exists
  if (!items.some(i => i.id && i.text)) {
    console.warn('⚠️ Refusing to save empty or invalid decisions');
    return;
  }
  localStorage.setItem(DECISIONS_LOCAL_KEY, JSON.stringify(items));
  decisionsCache = items;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await db
        .collection('decisions')
        .doc(currentUser.uid)
        .set({ items }, { merge: true });
      localStorage.removeItem(DECISIONS_LOCAL_KEY);
    } catch (err) {
      console.error('Failed to save decisions:', err);
      alert('⚠️ Failed to save changes.');
    }
  }, 200);
}

export async function flushPendingDecisions() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const pending = localStorage.getItem(DECISIONS_LOCAL_KEY);
  if (!pending) return;
  let items;
  try {
    items = JSON.parse(pending);
  } catch {
    return;
  }
  try {
    await db
      .collection('decisions')
      .doc(currentUser.uid)
      .set({ items }, { merge: true });
    localStorage.removeItem(DECISIONS_LOCAL_KEY);
    decisionsCache = items;
  } catch (err) {
    console.error('Failed to save decisions:', err);
    alert('⚠️ Failed to save changes.');
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
      .update({ goalOrder: order });
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

  // first-time sign-in: migrate legacy localStorage
  const legacy = JSON.parse(localStorage.getItem(LISTS_KEY) || '[]');
  if (legacy.length) {
    await db.collection('lists').doc(user.uid).set({ lists: legacy });
    localStorage.removeItem(LISTS_KEY);
    return legacy;
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
        start: cancelled ? '' : startInput.value,
        end: cancelled ? '' : endInput.value
      };
      dialog.remove();
      resolve(result);
    });

    dialog.showModal();
    startInput.focus();
    startInput.showPicker?.();
  });
}



