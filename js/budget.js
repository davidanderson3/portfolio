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
import { makeIconBtn } from './helpers.js';

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
  const out = {};
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
    budgetCache = migrateSubscriptions({ ...(localData || {}) });
    budgetCache.recurring = budgetCache.recurring || {};
    budgetCache.goalRecurring = budgetCache.goalRecurring || {};
    budgetCache.goalSubscriptions = budgetCache.goalSubscriptions || {};
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
  const useCloud = cloudTs > localTs || (cloudTs === localTs && !Object.keys(localData).length);
  const older = useCloud ? localData : cloudData;
  const newer = useCloud ? cloudData : localData;
  budgetCache = migrateSubscriptions(deepMerge(older, newer));
  budgetCache.recurring = budgetCache.recurring || {};
  budgetCache.goalRecurring = budgetCache.goalRecurring || {};
  budgetCache.goalSubscriptions = budgetCache.goalSubscriptions || {};
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
  budgetCache.goalRecurring = budgetCache.goalRecurring || {};
  budgetCache.goalSubscriptions = budgetCache.goalSubscriptions || {};
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
          <div class="section-title">Subscriptions</div>
          <div id="subsContainerA" class="subscriptions-list"></div>
        </form>
        <div id="budgetSummaryA" class="budget-summary"></div>
      </div>
      <div class="scenario" id="scenarioB">
        <div class="scenario-title">Goal</div>
        <form id="budgetFormB" class="budget-form">
          <div class="section-title">Recurring Expenses</div>
          <div id="recurContainerB" class="recurring-list"></div>

          <div class="section-title">Subscriptions</div>
          <div id="subsContainerB" class="subscriptions-list"></div>
        </form>
        <div id="budgetSummaryB" class="budget-summary"></div>
      </div>
    </div>
    <button type="button" id="addCategoryBtn">+ Add Category</button>
  `;

  const formA = panel.querySelector('#budgetFormA');
  const summaryA = panel.querySelector('#budgetSummaryA');
  const subsContainerA = formA.querySelector('#subsContainerA');
  const recurContainerA = formA.querySelector('#recurContainerA');
  const addCategoryBtn = panel.querySelector('#addCategoryBtn');
  const removedBuiltIns = new Set(saved.removedBuiltIns || []);

  const formB = panel.querySelector('#budgetFormB');
  const summaryB = panel.querySelector('#budgetSummaryB');
  const subsContainerB = formB.querySelector('#subsContainerB');
  const recurContainerB = formB.querySelector('#recurContainerB');

  function addSubscriptionRow(container, name = '', cost = '', id) {
    const row = document.createElement('div');
    row.className = 'subscription-row';
    if (id) row.dataset.id = id;
    row.innerHTML = `
      <input type="text" class="sub-name" placeholder="Name" value="${name}">
      <input type="number" class="sub-cost" value="${cost}">
    `;
    const rem = makeIconBtn('❌', 'Remove', () => {
      panel.querySelectorAll(`.subscription-row[data-id="${id}"]`).forEach(r => r.remove());
      render();
    });
    const up = makeIconBtn('⬆️', 'Move up', () => {
      panel.querySelectorAll(`.subscription-row[data-id="${id}"]`).forEach(r => {
        const prev = r.previousElementSibling;
        if (prev) r.parentElement.insertBefore(r, prev);
      });
      render();
    });
    const nameEl = row.querySelector('.sub-name');
    nameEl.addEventListener('input', () => {
      panel.querySelectorAll(`.subscription-row[data-id="${id}"] .sub-name`).forEach(el => {
        if (el !== nameEl) el.value = nameEl.value;
      });
    });
    row.append(up, rem);
    container.append(row);
  }

  function addSubscriptionRowPair(name = '', costA = '', costB = '') {
    const id = Math.random().toString(36).slice(2);
    addSubscriptionRow(subsContainerA, name, costA, id);
    addSubscriptionRow(subsContainerB, name, costB, id);
  }

  function addRecurRow(container, name = '', cost = '', fixed = false, key = '', id) {
    const row = document.createElement('div');
    row.className = 'recurring-row';
    if (id) row.dataset.id = id;
    if (key) row.dataset.field = key;
    row.innerHTML = `
      <input type="text" class="recur-name" placeholder="Name" value="${name}" ${fixed ? 'readonly' : ''}>
      <input type="number" class="recur-cost" value="${cost}">
    `;
    const rem = makeIconBtn('❌', 'Remove', () => {
      if (key) removedBuiltIns.add(key);
      panel.querySelectorAll(`.recurring-row[data-id="${id}"]`).forEach(r => r.remove());
      render();
    });
    const up = makeIconBtn('⬆️', 'Move up', () => {
      panel.querySelectorAll(`.recurring-row[data-id="${id}"]`).forEach(r => {
        const prev = r.previousElementSibling;
        if (prev) r.parentElement.insertBefore(r, prev);
      });
      render();
    });
    const nameEl = row.querySelector('.recur-name');
    if (!fixed) {
      nameEl.addEventListener('input', () => {
        panel.querySelectorAll(`.recurring-row[data-id="${id}"] .recur-name`).forEach(el => {
          if (el !== nameEl) el.value = nameEl.value;
        });
      });
    }
    row.append(up, rem);
    container.append(row);
  }

  function addRecurRowPair(name = '', costA = '', costB = '', fixed = false, key = '') {
    const id = key || Math.random().toString(36).slice(2);
    addRecurRow(recurContainerA, name, costA, fixed, key, id);
    addRecurRow(recurContainerB, name, costB, fixed, key, id);
  }

  const subNames = new Set([
    ...Object.keys(saved.subscriptions || {}),
    ...Object.keys(saved.goalSubscriptions || {})
  ]);
  if (subNames.size === 0) {
    subNames.add('Amazon Prime');
    subNames.add('Spotify');
  }
  subNames.forEach(n => addSubscriptionRowPair(n, saved.subscriptions?.[n] ?? '', saved.goalSubscriptions?.[n] ?? ''));

  const recurNames = new Set([
    ...Object.keys(saved.recurring || {}),
    ...Object.keys(saved.goalRecurring || {})
  ]);
  DEFAULT_RECURRING.forEach(([key, label]) => {
    if (!removedBuiltIns.has(key)) {
      addRecurRowPair(label, saved[key] ?? '', saved[`goal_${key}`] ?? '', true, key);
    }
  });
  recurNames.forEach(n => addRecurRowPair(n, saved.recurring?.[n] ?? '', saved.goalRecurring?.[n] ?? ''));
  addCategoryBtn.addEventListener('click', () => { addRecurRowPair(); render(); });

  function collectScenario(recurContainer, subsContainer, removedSet, options = {}) {
    const prefix = options.prefix || '';
    const recurField = options.recurringField || 'recurring';
    const subsField = options.subscriptionsField || 'subscriptions';
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
        saveData[prefix + key] = v;
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
    saveData[recurField] = recur;
    saveData[subsField] = subs;
    return { categories, recur, subs, saveData };
  }

  function render(save = true) {
    const aData = collectScenario(recurContainerA, subsContainerA, removedBuiltIns, {
      prefix: '',
      recurringField: 'recurring',
      subscriptionsField: 'subscriptions'
    });
    const bData = collectScenario(recurContainerB, subsContainerB, removedBuiltIns, {
      prefix: 'goal_',
      recurringField: 'goalRecurring',
      subscriptionsField: 'goalSubscriptions'
    });

    const resultA = calculateMonthlyBudget({ salary, categories: aData.categories });
    const resultB = calculateMonthlyBudget({ salary, categories: bData.categories });

    summaryA.innerHTML =
      `Total Expenses: $${resultA.expenses.toLocaleString()}<br>` +
      `Leftover: $${resultA.leftover.toLocaleString()}`;
    summaryB.innerHTML =
      `Total Expenses: $${resultB.expenses.toLocaleString()}<br>` +
      `Leftover: $${resultB.leftover.toLocaleString()}`;

    if (save) {
      const dataToSave = { ...aData.saveData, ...bData.saveData };
      saveBudgetData(dataToSave);
    }
  }
    // Update summaries as the user types but avoid saving on every keystroke.
    formA.addEventListener('input', () => render(false));
    formB.addEventListener('input', () => render(false));
    // Persist data only after the user commits a change.
    formA.addEventListener('change', () => render(true));
    formB.addEventListener('change', () => render(true));
    render(false);
  }

if (typeof window !== 'undefined') {
  window.initBudgetPanel = initBudgetPanel;
}
