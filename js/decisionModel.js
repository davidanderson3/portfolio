// js/decisionModel.js
import { getCurrentUser } from './auth.js';

export function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

export async function loadDecisions() {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  return Array.isArray(data?.list) ? data.list : [];
}

export async function saveDecisions(decisions) {
  const currentUser = getCurrentUser();
  if (!currentUser || !Array.isArray(decisions)) return;
  await db.collection('decisions').doc(currentUser.uid).set({ list: decisions });
}

export async function saveGoalOrder(order) {
  const currentUser = getCurrentUser();
  if (!currentUser || !Array.isArray(order)) return;
  await db.collection('decisions').doc(currentUser.uid).set({ goalOrder: order }, { merge: true });
}
