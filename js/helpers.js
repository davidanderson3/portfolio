import { getCurrentUser, db } from './auth.js';

export function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

export async function loadDecisions() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.warn('🚫 No current user set — skipping loadDecisions');
    return [];
  }

  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  return data && Array.isArray(data.items) ? data.items : [];  // ✅ fixed
}

export async function saveDecisions(items) {
  const currentUser = getCurrentUser();
 if (!currentUser) return;

 if (!Array.isArray(items)) return;

  const hasGoalsOrTasks = items.some(item => item.text && item.id);
  if (!hasGoalsOrTasks) {
    console.warn('⚠️ Refusing to save empty or invalid decisions');
    return;
  }

  await db.collection('decisions').doc(currentUser.uid).set({ items }, { merge: true });
}

export async function saveGoalOrder(order) {
  const currentUser = getCurrentUser();
  if (!currentUser || !Array.isArray(order)) return;

  if (order.length === 0) {
    console.warn('⚠️ Refusing to save empty goalOrder');
    return;
  }

  await db.collection('decisions').doc(currentUser.uid).set({ goalOrder: order }, { merge: true });
}


export function parseNaturalDate(input) {
  const today = new Date();
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const normalized = input.trim().toLowerCase();

  if (normalized === 'today') {
    return today.toISOString().split('T')[0];
  }

  const match = weekdays.find(d => normalized.startsWith(d));
  if (match) {
    const targetDay = weekdays.indexOf(match);
    const currentDay = today.getDay();
    let delta = targetDay - currentDay;
    if (delta <= 0) delta += 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + delta);
    return nextDate.toISOString().split('T')[0];
  }

  return null;
}

export function formatDaysUntil(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  return `overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
}
