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
  const leftover = calculatedNetPay - categoryTotal;
  return { federalTax, tax, netPay: calculatedNetPay, monthlyIncome, expenses, leftover };
}

import { loadPlanningData } from './planning.js';
import { getCurrentUser, db } from './auth.js';

const BUDGET_KEY = 'budgetConfig';
let budgetCache = null;

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
  const panel = document.getElementById('budgetPanel');
  if (!panel) return;
  const planning = await loadPlanningData();
  const salary = Number(planning?.finance?.income || 0);
  const saved = await loadBudgetData();
  panel.innerHTML = `
    <div id="budgetLayout">
      <form id="budgetForm" class="budget-form">
        <div class="section-title">Recurring Expenses</div>
        <label>Mortgage Interest <input type="number" name="mortgageInterest" value="${saved.mortgageInterest ?? ''}" /></label>
        <label>Mortgage Principal <input type="number" name="mortgagePrincipal" value="${saved.mortgagePrincipal ?? ''}" /></label>
        <label>Escrow <input type="number" name="escrow" value="${saved.escrow ?? ''}" /></label>
        <label>Electric <input type="number" name="electric" value="${saved.electric ?? ''}" /></label>
        <label>Water <input type="number" name="water" value="${saved.water ?? ''}" /></label>
        <label>Gas <input type="number" name="gas" value="${saved.gas ?? ''}" /></label>
        <label>Internet <input type="number" name="internet" value="${saved.internet ?? ''}" /></label>
        <label>Cell Phone <input type="number" name="cell" value="${saved.cell ?? ''}" /></label>
        <label>Food <input type="number" name="food" value="${saved.food ?? ''}" /></label>
        <label>Gas (Car) <input type="number" name="transGas" value="${saved.transGas ?? ''}" /></label>
        <label>Car Payment <input type="number" name="carPayment" value="${saved.carPayment ?? ''}" /></label>
        <label>Tolls <input type="number" name="tolls" value="${saved.tolls ?? ''}" /></label>
        <label>Car Insurance <input type="number" name="insurance" value="${saved.insurance ?? ''}" /></label>
        <label>Health Insurance <input type="number" name="healthInsurance" value="${saved.healthInsurance ?? ''}" /></label>
        <label>Dental Insurance <input type="number" name="dentalInsurance" value="${saved.dentalInsurance ?? ''}" /></label>
        <label>Savings <input type="number" name="savings" value="${saved.savings ?? ''}" /></label>
        <label>TSP <input type="number" name="tsp" value="${saved.tsp ?? ''}" /></label>
        <label>Federal Deductions <input type="number" name="federalDeductions" value="${saved.federalDeductions ?? ''}" /></label>
        <label>State Taxes <input type="number" name="stateTaxes" value="${saved.stateTaxes ?? ''}" /></label>
        <div id="recurContainer" class="recurring-list"></div>
        <button type="button" id="addRecurBtn">+ Add Category</button>

        <div class="section-title">Subscriptions</div>
        <div id="subsContainer" class="subscriptions-list"></div>
        <button type="button" id="addSubBtn">+ Add Subscription</button>

        <div class="section-title">Other Spending</div>
        <label>Misc <input type="number" name="misc" value="${saved.misc ?? ''}" /></label>

      </form>
      <div id="budgetSummary" class="budget-summary"></div>
    </div>
  `;

  const form = panel.querySelector('#budgetForm');
  const summary = panel.querySelector('#budgetSummary');
  const subsContainer = form.querySelector('#subsContainer');
  const addSubBtn = form.querySelector('#addSubBtn');
  const recurContainer = form.querySelector('#recurContainer');
  const addRecurBtn = form.querySelector('#addRecurBtn');

  function addSubscriptionRow(name = '', cost = '') {
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
    subsContainer.append(row);
  }

  function addRecurRow(name = '', cost = '') {
    const row = document.createElement('div');
    row.className = 'recurring-row';
    row.innerHTML = `
      <input type="text" class="recur-name" placeholder="Name" value="${name}">
      <input type="number" class="recur-cost" value="${cost}">
    `;
    const rem = document.createElement('button');
    rem.type = 'button';
    rem.textContent = '❌';
    rem.onclick = () => { row.remove(); render(); };
    row.append(rem);
    recurContainer.append(row);
  }

  const initialSubs = Object.keys(saved.subscriptions || {}).length
    ? saved.subscriptions
    : { 'Amazon Prime': '', 'Spotify': '' };
  Object.entries(initialSubs).forEach(([n, c]) => addSubscriptionRow(n, c));
  addSubBtn.addEventListener('click', () => { addSubscriptionRow(); });

  const initialRecur = saved.recurring || {};
  Object.entries(initialRecur).forEach(([n, c]) => addRecurRow(n, c));
  addRecurBtn.addEventListener('click', () => { addRecurRow(); });

  function render(save = true) {
    const fields = ['mortgageInterest', 'mortgagePrincipal', 'escrow', 'electric', 'water', 'gas', 'internet', 'cell', 'food', 'transGas', 'carPayment', 'tolls', 'insurance', 'healthInsurance', 'dentalInsurance', 'savings', 'tsp', 'federalDeductions', 'stateTaxes', 'misc'];
    const categories = {};
    fields.forEach(f => { categories[f] = form[f].value; });
    const recur = {};
    recurContainer.querySelectorAll('.recurring-row').forEach(row => {
      const n = row.querySelector('.recur-name').value.trim();
      const v = row.querySelector('.recur-cost').value;
      if (n) {
        categories[n] = v;
        recur[n] = v;
      }
    });
    const subs = {};
    subsContainer.querySelectorAll('.subscription-row').forEach(row => {
      const n = row.querySelector('.sub-name').value.trim();
      const v = row.querySelector('.sub-cost').value;
      if (n) {
        categories[n] = v;
        subs[n] = v;
      }
    });
    const result = calculateMonthlyBudget({ salary, categories });
    summary.innerHTML =
      `Total Expenses: $${result.expenses.toLocaleString()}<br>` +
      `Leftover: $${result.leftover.toLocaleString()}`;
    const saveData = {};
    fields.forEach(f => { saveData[f] = form[f].value; });
    saveData.subscriptions = subs;
    saveData.recurring = recur;
    if (save) {
      saveBudgetData(saveData);
    }
  }
  form.addEventListener('input', () => render(false));
  form.addEventListener('change', () => render(true));
  render(false);
}

if (typeof window !== 'undefined') {
  window.initBudgetPanel = initBudgetPanel;
}
