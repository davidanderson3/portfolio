export const FEDERAL_TAX_RATE = 0.10;
export const STATE_TAX_RATES = {
  'CA': 0.09,
  'NY': 0.06,
  'TX': 0.00
};
export const CITY_TAX_RATES = {
  'Los Angeles': 0.02,
  'San Francisco': 0.013,
  'New York': 0.03
};

export function getTaxRates(state, city) {
  const stateRate = STATE_TAX_RATES[state] || 0;
  const cityRate = CITY_TAX_RATES[city] || 0;
  return { stateRate, cityRate };
}

export function calculateMonthlyBudget({ salary, state, city, categories }) {
  salary = Number(salary) || 0;
  const cats = { ...categories };
  Object.keys(cats).forEach(k => { cats[k] = Number(cats[k]) || 0; });
  const { stateRate, cityRate } = getTaxRates(state, city);

  const federalTax = Math.round(salary * FEDERAL_TAX_RATE / 12);
  const stateTax = Math.round(salary * (stateRate + cityRate) / 12);
  const tax = federalTax + stateTax;

  const monthlyIncome = salary / 12;
  const netPay = monthlyIncome - tax;
  const expenses = Object.values(cats).reduce((s, v) => s + v, 0) + tax;
  const leftover = monthlyIncome - expenses;
  return { federalTax, stateTax, tax, netPay, monthlyIncome, expenses, leftover };
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

  budgetCache = migrateSubscriptions(deepMerge(cloudData, localData));
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
  const panel = document.getElementById('budgetPanel');
  if (!panel) return;
  const planning = await loadPlanningData();
  const salary = Number(planning?.finance?.income || 0);
  const saved = await loadBudgetData();
  panel.innerHTML = `
    <div id="budgetLayout">
      <form id="budgetForm" class="budget-form">
        <div>Annual Salary: <span id="budgetSalary">$${salary.toLocaleString()}</span></div>
        <div class="section-title">Configuration</div>
        <label>State <input type="text" name="state" value="${saved.state ?? ''}" /></label>
        <label>City <input type="text" name="city" value="${saved.city ?? ''}" /></label>

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
        <label>Healthcare <input type="number" name="healthcare" value="${saved.healthcare ?? ''}" /></label>
        <label>Savings <input type="number" name="savings" value="${saved.savings ?? ''}" /></label>
        <label>TSP <input type="number" name="tsp" value="${saved.tsp ?? ''}" /></label>
        <label>Health Savings Account <input type="number" name="hsa" value="${saved.hsa ?? ''}" /></label>

        <div class="section-title">Subscriptions</div>
        <div id="subsContainer" class="subscriptions-list"></div>
        <button type="button" id="addSubBtn">+ Add Subscription</button>

        <div class="section-title">Other Spending</div>
        <label>Misc <input type="number" name="misc" value="${saved.misc ?? ''}" /></label>

        <div class="section-title">Taxes</div>
        <label>Federal Tax <input type="number" name="federalTax" disabled /></label>
        <label>State Tax <input type="number" name="stateTax" disabled /></label>
      </form>
      <div id="budgetSummary" class="budget-summary"></div>
    </div>
  `;

  const form = panel.querySelector('#budgetForm');
  const summary = panel.querySelector('#budgetSummary');
  const subsContainer = form.querySelector('#subsContainer');
  const addSubBtn = form.querySelector('#addSubBtn');

  function addSubscriptionRow(name = '', cost = '') {
    const row = document.createElement('div');
    row.className = 'subscription-row';
    row.innerHTML = `
      <input type="text" class="sub-name" placeholder="Name" value="${name}">
      <input type="number" class="sub-cost" value="${cost}" style="width:80px;">
    `;
    const rem = document.createElement('button');
    rem.type = 'button';
    rem.textContent = '❌';
    rem.onclick = () => { row.remove(); render(); };
    row.append(rem);
    subsContainer.append(row);
  }

  const initialSubs = Object.keys(saved.subscriptions || {}).length
    ? saved.subscriptions
    : { 'Amazon Prime': '', 'Spotify': '' };
  Object.entries(initialSubs).forEach(([n, c]) => addSubscriptionRow(n, c));
  addSubBtn.addEventListener('click', () => { addSubscriptionRow(); });

  function render() {
    const fields = ['mortgageInterest', 'mortgagePrincipal', 'escrow', 'electric', 'water', 'gas', 'internet', 'cell', 'food', 'transGas', 'carPayment', 'tolls', 'insurance', 'healthInsurance', 'dentalInsurance', 'healthcare', 'savings', 'tsp', 'hsa', 'misc'];
    const categories = {};
    fields.forEach(f => { categories[f] = form[f].value; });
    const subs = {};
    subsContainer.querySelectorAll('.subscription-row').forEach(row => {
      const n = row.querySelector('.sub-name').value.trim();
      const v = row.querySelector('.sub-cost').value;
      if (n) {
        categories[n] = v;
        subs[n] = v;
      }
    });
    const state = form.state.value.trim();
    const city = form.city.value.trim();
    const result = calculateMonthlyBudget({ salary, state, city, categories });
    form.federalTax.value = result.federalTax;
    form.stateTax.value = result.stateTax;
    summary.innerHTML =
      `Federal Tax: $${result.federalTax.toLocaleString()}<br>` +
      `State Tax: $${result.stateTax.toLocaleString()}<br>` +
      `Net Pay: $${result.netPay.toLocaleString()}<br>` +
      `Total Expenses: $${result.expenses.toLocaleString()}<br>` +
      `Leftover: $${result.leftover.toLocaleString()}`;
    const saveData = { state, city, subscriptions: subs };
    fields.forEach(f => { saveData[f] = form[f].value; });
    saveBudgetData(saveData);
  }
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
}

if (typeof window !== 'undefined') {
  window.initBudgetPanel = initBudgetPanel;
}
