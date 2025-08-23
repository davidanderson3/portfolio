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
export function calculateMonthlyBudget({ salary, netPay, categories, incomeCategories = {} }) {
  salary = Number(salary) || 0;
  netPay = Number(netPay) || 0;
  const cats = { ...categories };
  Object.keys(cats).forEach(k => { cats[k] = Number(cats[k]) || 0; });
  const incomes = { ...incomeCategories };
  Object.keys(incomes).forEach(k => { incomes[k] = Number(incomes[k]) || 0; });

  const monthlyIncome = salary ? salary / 12 : netPay;
  const federalTax = Math.round(monthlyIncome * FEDERAL_TAX_RATE);
  const tax = federalTax;

  const additionalIncome = Object.values(incomes).reduce((s, v) => s + v, 0);
  const calculatedNetPay = monthlyIncome - tax + additionalIncome;
  const categoryTotal = Object.values(cats).reduce((s, v) => s + v, 0);
  const expenses = categoryTotal;
  const leftover = monthlyIncome + additionalIncome - categoryTotal;
  return {
    federalTax,
    tax,
    netPay: calculatedNetPay,
    monthlyIncome,
    expenses,
    leftover,
    income: additionalIncome
  };
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
  ['investmentAccounts', 'Investment Accounts'],
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
    localStorage.removeItem(BUDGET_KEY);
    budgetCache = migrateSubscriptions({});
    budgetCache.recurring = {};
    budgetCache.goalRecurring = {};
    budgetCache.goalSubscriptions = {};
    return budgetCache;
  }

  let cloudData = {};
  let cloudExists = false;
  try {
    const snap = await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(BUDGET_KEY)
      .get();
    if (snap) {
      cloudExists = !!snap.exists;
      cloudData = cloudExists ? snap.data() : {};
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

  let shouldSave = !cloudExists;
  if (cloudExists && localTs > cloudTs) {
    const ask = () => {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        return window.confirm('Upload local budget changes to the cloud?');
      }
      return false;
    };
    shouldSave = ask();
  }

  if (shouldSave) {
    try {
      await db
        .collection('users').doc(user.uid)
        .collection('settings').doc(BUDGET_KEY)
        .set(budgetCache, { merge: true });
    } catch (err) {
      console.error('Failed to save budget data:', err);
    }
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
  if (!user) {
    localStorage.removeItem(BUDGET_KEY);
    return;
  }
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgetCache));
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
      <table id="budgetTable">
        <thead>
          <tr>
            <th>Category</th>
            <th>Current</th>
            <th>Goal</th>
            <th>Change</th>
            <th>% Change</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="budgetTbody"></tbody>
      </table>
      <div id="budgetSummary" class="budget-summary"></div>
      <button type="button" id="addCategoryBtn">+ Add Category</button>
    </div>
  `;

  const tbody = panel.querySelector('#budgetTbody');
  const summary = panel.querySelector('#budgetSummary');
  const addCategoryBtn = panel.querySelector('#addCategoryBtn');
  const removedBuiltIns = new Set(saved.removedBuiltIns || []);

  function addRow(name = '', current = '', goal = '', key = '') {
    const id = key || Math.random().toString(36).slice(2);
    const tr = document.createElement('tr');
    tr.className = 'budget-row';
    tr.dataset.id = id;
    if (key) tr.dataset.field = key;
    tr.innerHTML = `
      <td class="cat-name">${name}</td>
      <td><input type="number" class="current-cost" value="${current}"></td>
      <td><input type="number" class="goal-cost" value="${goal}"></td>
      <td class="change-cell"></td>
      <td class="percent-cell"></td>
      <td class="actions"></td>
    `;
    const actions = tr.querySelector('.actions');
    const up = makeIconBtn('⬆️', 'Move up', () => {
      const prev = tr.previousElementSibling;
      if (prev) tbody.insertBefore(tr, prev);
      render();
    });
    const rem = makeIconBtn('❌', 'Remove', () => {
      if (key) removedBuiltIns.add(key);
      tr.remove();
      render();
    });
    actions.append(up, rem);
    tbody.append(tr);
  }

  const recurNames = new Set([
    ...Object.keys(saved.recurring || {}),
    ...Object.keys(saved.goalRecurring || {})
  ]);
  DEFAULT_RECURRING.forEach(([key, label]) => {
    if (!removedBuiltIns.has(key)) {
      addRow(label, saved[key] ?? '', saved[`goal_${key}`] ?? '', key);
    }
  });
  recurNames.forEach(n => addRow(n, saved.recurring?.[n] ?? '', saved.goalRecurring?.[n] ?? ''));

  addCategoryBtn.addEventListener('click', () => {
    const name = typeof prompt === 'function' ? prompt('Category name?') : '';
    if (name) {
      addRow(name);
      render();
    }
  });

  function collectData() {
    const categoriesCurrent = {};
    const categoriesGoal = {};
    const saveData = {
      removedBuiltIns: Array.from(removedBuiltIns),
      recurring: {},
      goalRecurring: {},
      subscriptions: {},
      goalSubscriptions: {}
    };
    tbody.querySelectorAll('tr').forEach(row => {
      const name = row.querySelector('.cat-name').textContent.trim();
      const curVal = row.querySelector('.current-cost').value;
      const goalVal = row.querySelector('.goal-cost').value;
      const field = row.dataset.field;
      if (name) {
        categoriesCurrent[name] = curVal;
        categoriesGoal[name] = goalVal;
        if (field) {
          saveData[field] = curVal;
          saveData['goal_' + field] = goalVal;
        } else {
          if (curVal) saveData.recurring[name] = curVal;
          if (goalVal) saveData.goalRecurring[name] = goalVal;
        }
      }
    });
    return { categoriesCurrent, categoriesGoal, saveData };
  }

  function render(save = true) {
    const { categoriesCurrent, categoriesGoal, saveData } = collectData();
    tbody.querySelectorAll('tr').forEach(row => {
      const cur = parseFloat(row.querySelector('.current-cost').value) || 0;
      const goal = parseFloat(row.querySelector('.goal-cost').value) || 0;
      const diff = goal - cur;
      const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
      row.querySelector('.change-cell').textContent = `${sign}$${Math.abs(diff).toFixed(2)}`;
      let pct;
      if (cur === 0) {
        pct = goal === 0 ? '0%' : 'n/a';
      } else {
        pct = ((Math.abs(diff) / cur) * 100).toFixed(1) + '%';
        if (sign) pct = sign + pct;
      }
      row.querySelector('.percent-cell').textContent = pct;
    });
    const toNumber = obj => Object.values(obj).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const totalCur = toNumber(categoriesCurrent);
    const totalGoal = toNumber(categoriesGoal);
    const changeTotal = totalGoal - totalCur;
    const signTotal = changeTotal > 0 ? '+' : changeTotal < 0 ? '-' : '';
    summary.innerHTML =
      `Current Expenses: $${totalCur.toLocaleString()}<br>` +
      `Goal Expenses: $${totalGoal.toLocaleString()}<br>` +
      `Change: ${signTotal}$${Math.abs(changeTotal).toLocaleString()}`;
    if (save) saveBudgetData(saveData);
  }

  tbody.addEventListener('input', () => render(false));
  tbody.addEventListener('change', () => render(true));
  render(false);
}

if (typeof window !== 'undefined') {
  window.initBudgetPanel = initBudgetPanel;
}
