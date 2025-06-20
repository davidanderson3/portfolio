import { getCurrentUser, db } from './auth.js';

export function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

export async function loadDecisions() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.warn('🚫 No current user — skipping loadDecisions');
    return [];
  }
  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  return data && Array.isArray(data.items) ? data.items : [];
}

export async function saveDecisions(items) {
  const currentUser = getCurrentUser();
  if (!currentUser || !Array.isArray(items)) return;
  // ensure at least one valid decision exists
  if (!items.some(i => i.id && i.text)) {
    console.warn('⚠️ Refusing to save empty or invalid decisions');
    return;
  }

  // merge in the items array without overwriting other fields
  await db
    .collection('decisions')
    .doc(currentUser.uid)
    .set({ items }, { merge: true });
}

export async function saveGoalOrder(order) {
  const currentUser = getCurrentUser();
  if (!currentUser || !Array.isArray(order) || order.length === 0) {
    console.warn('⚠️ Refusing to save empty goalOrder');
    return;
  }

  await db
    .collection('decisions')
    .doc(currentUser.uid)
    .update({ goalOrder: order });
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
  const target = new Date(dateStr);
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  return `overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
}
