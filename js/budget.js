export const FEDERAL_TAX_RATE = 0.10;
/**
 * Calculates a monthly budget summary.
 *
 * When no annual salary is provided, the `netPay` argument is treated as the
 * gross monthly income and taxes are deducted from it.
 *
 * The returned expenses exclude federal taxes and represent only recurring
 * expenses and subscriptions.
*/
export function calculateMonthlyBudget({ salary, netPay, categories }) {
  salary = Number(salary) || 0;
  netPay = Number(netPay) || 0;
  const cats = { ...categories };
  Object.keys(cats).forEach(k => { cats[k] = Number(cats[k]) || 0; });

  const monthlyIncome = salary ? salary / 12 : netPay;
  const federalTax = Math.round(monthlyIncome * FEDERAL_TAX_RATE);
  const tax = federalTax;

  const calculatedNetPay = monthlyIncome - tax;
  const categoryTotal = Object.values(cats).reduce((s, v) => s + v, 0);
  const expenses = categoryTotal;
  const leftover = monthlyIncome - categoryTotal;
  return { federalTax, tax, netPay: calculatedNetPay, monthlyIncome, expenses, leftover };
}

import { loadPlanningData } from './planning.js';
import { getCurrentUser, db } from './auth.js';

const BUDGET_KEY = 'budgetConfig';
let budgetCache = null;

const DEFAULT_RECURRING = [
  ['mortgageInterest', 'Mortgage Interest'],
  ['mortgagePrincipal', 'Mortgage Principal'],
  ['escrow', 'Escrow'],
  ['electric', 'Electric'],
  ['water', 'Water'],
  ['gas', 'Gas'],
  ['internet', 'Internet'],
  ['cell', 'Cell Phone'],
  ['food', 'Food'],
  ['transGas', 'Gas (Car)'],
  ['carPayment', 'Car Payment'],
  ['tolls', 'Tolls'],
  ['insurance', 'Car Insurance'],
  ['healthInsurance', 'Health Insurance'],
  ['dentalInsurance', 'Dental Insurance'],
  ['savings', 'Savings'],
  ['tsp', 'TSP'],
  ['federalDeductions', 'Federal Deductions'],
  ['stateTaxes', 'State Taxes'],
  ['misc', 'Misc']
];

function isObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}

function deepMerge(base = {}, override = {}) {
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const bVal = base[key];
    const oVal = override[key];
    if (isObject(bVal) && isObject(oVal)) {
      out[key] = deepMerge(bVal, oVal);
    } else {
      out[key] = oVal;
    }
  }
  return out;
}

function migrateSubscriptions(data = {}) {
  data.subscriptions = data.subscriptions || {};
  if (data.prime) {
    data.subscriptions['Amazon Prime'] = data.prime;
    delete data.prime;
  }
  if (data.spotify) {
    data.subscriptions['Spotify'] = data.spotify;
    delete data.spotify;
  }
  return data;
}

export async function loadBudgetData() {
  const user = getCurrentUser?.();

  let localData = {};
  const stored = localStorage.getItem(BUDGET_KEY);
  if (stored) {
    try {
      localData = JSON.parse(stored) || {};
    } catch (err) {
      console.warn('Failed to parse budget data:', err);
    }
  }

  if (!user) {
    budgetCache = localData;
    return budgetCache;
  }

  let cloudData = {};
  try {
    const snap = await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(BUDGET_KEY)
      .get();
    if (snap) {
      cloudData = snap.exists ? snap.data() : {};
    }
  } catch (err) {
    console.error('Failed to fetch budget data:', err);
  }

  const localTs = localData.lastUpdated || 0;
  const cloudTs = cloudData.lastUpdated || 0;
  const older = cloudTs >= localTs ? localData : cloudData;
  const newer = cloudTs >= localTs ? cloudData : localData;
  budgetCache = migrateSubscriptions(deepMerge(older, newer));
  budgetCache.recurring = budgetCache.recurring || {};
  budgetCache.lastUpdated = Math.max(localTs, cloudTs);
  try {
    await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(BUDGET_KEY)
      .set(budgetCache, { merge: true });
  } catch (err) {
    console.error('Failed to save budget data:', err);
  }

  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgetCache));
  return budgetCache;
}

export async function saveBudgetData(data) {
  budgetCache = migrateSubscriptions(data || {});
  budgetCache.recurring = budgetCache.recurring || {};
  budgetCache.lastUpdated = Date.now();
  const user = getCurrentUser?.();
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgetCache));
  if (!user) {
    return;
  }
  try {
    await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(BUDGET_KEY)
      .set(budgetCache, { merge: true });
  } catch (err) {
    console.error('Failed to save budget data:', err);
  }
}

export async function calculateCurrentMonthlyBudget() {
  const planning = await loadPlanningData();
  const budget = await loadBudgetData();
  const salary = Number(planning?.finance?.income || 0);
  const { subscriptions = {}, recurring = {}, netPay: _ignore, ...rest } = budget;
  const categories = { ...rest, ...recurring, ...subscriptions };
  return calculateMonthlyBudget({ salary, categories });
}

export async function initBudgetPanel() {
  const panel = document.getElementById('budgetContainer');
  if (!panel) return;
  const planning = await loadPlanningData();
  const salary = Number(planning?.finance?.income || 0);
  const saved = await loadBudgetData();
  panel.innerHTML = `
    <div id="budgetLayout">
      <div class="scenario" id="scenarioA">
        <div class="scenario-title">Current</div>
        <form id="budgetFormA" class="budget-form">
          <div class="section-title">Recurring Expenses</div>
          <div id="recurContainerA" class="recurring-list"></div>
          <button type="button" id="addRecurBtnA">+ Add Category</button>

          <div class="section-title">Subscriptions</div>
          <div id="subsContainerA" class="subscriptions-list"></div>
          <button type="button" id="addSubBtnA">+ Add Subscription</button>
        </form>
        <div id="budgetSummaryA" class="budget-summary"></div>
      </div>
      <div class="scenario" id="scenarioB">
        <div class="scenario-title">Goal</div>
        <form id="budgetFormB" class="budget-form">
          <div class="section-title">Recurring Expenses</div>
          <div id="recurContainerB" class="recurring-list"></div>
          <button type="button" id="addRecurBtnB">+ Add Category</button>

          <div class="section-title">Subscriptions</div>
          <div id="subsContainerB" class="subscriptions-list"></div>
          <button type="button" id="addSubBtnB">+ Add Subscription</button>
        </form>
        <div id="budgetSummaryB" class="budget-summary"></div>
      </div>
    </div>
  `;

  const formA = panel.querySelector('#budgetFormA');
  const summaryA = panel.querySelector('#budgetSummaryA');
  const subsContainerA = formA.querySelector('#subsContainerA');
  const addSubBtnA = formA.querySelector('#addSubBtnA');
  const recurContainerA = formA.querySelector('#recurContainerA');
  const addRecurBtnA = formA.querySelector('#addRecurBtnA');
  const removedBuiltInsA = new Set(saved.removedBuiltIns || []);

  const formB = panel.querySelector('#budgetFormB');
  const summaryB = panel.querySelector('#budgetSummaryB');
  const subsContainerB = formB.querySelector('#subsContainerB');
  const addSubBtnB = formB.querySelector('#addSubBtnB');
  const recurContainerB = formB.querySelector('#recurContainerB');
  const addRecurBtnB = formB.querySelector('#addRecurBtnB');

  function addSubscriptionRow(container, name = '', cost = '') {
    const row = document.createElement('div');
    row.className = 'subscription-row';
    row.innerHTML = `
      <input type="text" class="sub-name" placeholder="Name" value="${name}">
      <input type="number" class="sub-cost" value="${cost}">
    `;
    const rem = document.createElement('button');
    rem.type = 'button';
    rem.textContent = '❌';
    rem.onclick = () => { row.remove(); render(); };
    row.append(rem);
    container.append(row);
  }

  function addRecurRow(container, removedSet, name = '', cost = '', fixed = false, key = '') {
    const row = document.createElement('div');
    row.className = 'recurring-row';
    if (key) row.dataset.field = key;
    row.innerHTML = `
      <input type="text" class="recur-name" placeholder="Name" value="${name}" ${fixed ? 'readonly' : ''}>
      <input type="number" class="recur-cost" value="${cost}">
    `;
    const rem = document.createElement('button');
    rem.type = 'button';
    rem.textContent = '❌';
    rem.onclick = () => {
      if (key) removedSet.add(key);
      row.remove();
      render();
    };
    row.append(rem);
    container.append(row);
  }

  const initialSubs = Object.keys(saved.subscriptions || {}).length
    ? saved.subscriptions
    : { 'Amazon Prime': '', 'Spotify': '' };
  Object.entries(initialSubs).forEach(([n, c]) => addSubscriptionRow(subsContainerA, n, c));
  addSubBtnA.addEventListener('click', () => { addSubscriptionRow(subsContainerA); });

  addSubBtnB.addEventListener('click', () => { addSubscriptionRow(subsContainerB); });

  const initialRecur = saved.recurring || {};
  DEFAULT_RECURRING.forEach(([key, label]) => {
    if (!removedBuiltInsA.has(key)) {
      addRecurRow(recurContainerA, removedBuiltInsA, label, saved[key] ?? '', true, key);
    }
  });
  Object.entries(initialRecur).forEach(([n, c]) => addRecurRow(recurContainerA, removedBuiltInsA, n, c));
  addRecurBtnA.addEventListener('click', () => { addRecurRow(recurContainerA, removedBuiltInsA); });

  DEFAULT_RECURRING.forEach(([key, label]) => {
    addRecurRow(recurContainerB, new Set(), label, '', true, key);
  });
  addRecurBtnB.addEventListener('click', () => { addRecurRow(recurContainerB, new Set()); });

  function collectScenario(recurContainer, subsContainer, removedSet) {
    const categories = {};
    const recur = {};
    const subs = {};
    const saveData = { removedBuiltIns: Array.from(removedSet) };
    recurContainer.querySelectorAll('.recurring-row').forEach(row => {
      const nameEl = row.querySelector('.recur-name');
      const n = nameEl.value.trim();
      const v = row.querySelector('.recur-cost').value;
      if (!n) return;
      categories[n] = v;
      const key = row.dataset.field;
      if (key) {
        saveData[key] = v;
      } else {
        recur[n] = v;
      }
    });
    subsContainer.querySelectorAll('.subscription-row').forEach(row => {
      const n = row.querySelector('.sub-name').value.trim();
      const v = row.querySelector('.sub-cost').value;
      if (n) {
        categories[n] = v;
        subs[n] = v;
      }
    });
    return { categories, recur, subs, saveData };
  }

  function render(save = true) {
    const aData = collectScenario(recurContainerA, subsContainerA, removedBuiltInsA);
    const bData = collectScenario(recurContainerB, subsContainerB, new Set());

    const resultA = calculateMonthlyBudget({ salary, categories: aData.categories });
    const resultB = calculateMonthlyBudget({ salary, categories: bData.categories });

    summaryA.innerHTML =
      `Total Expenses: $${resultA.expenses.toLocaleString()}<br>` +
      `Leftover: $${resultA.leftover.toLocaleString()}`;
    summaryB.innerHTML =
      `Total Expenses: $${resultB.expenses.toLocaleString()}<br>` +
      `Leftover: $${resultB.leftover.toLocaleString()}`;

    aData.saveData.subscriptions = aData.subs;
    aData.saveData.recurring = aData.recur;
    if (save) {
      saveBudgetData(aData.saveData);
    }
  }
  formA.addEventListener('input', () => render(true));
  formB.addEventListener('input', () => render(false));
  formB.addEventListener('change', () => render(false));
  render(false);
}

if (typeof window !== 'undefined') {
  window.initBudgetPanel = initBudgetPanel;
}
