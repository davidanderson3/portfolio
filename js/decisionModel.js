// js/decisionModel.js
import { getCurrentUser } from './auth.js';

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
  await db.collection('decisions').doc(currentUser.uid).set({ items }, { merge: true });
}

export async function saveGoalOrder(order) {
  const currentUser = getCurrentUser();
  if (!currentUser || !Array.isArray(order)) return;
  await db.collection('decisions').doc(currentUser.uid).set({ goalOrder: order }, { merge: true });
}
