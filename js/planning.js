import { getCurrentUser, db } from './auth.js';

export function calculateFinanceProjection({ currentAge, retirementAge, savings, income, returnRate }) {
  currentAge = Number(currentAge);
  retirementAge = Number(retirementAge);
  savings = Number(savings);
  income = Number(income);
  returnRate = Number(returnRate) / 100;
  const years = retirementAge - currentAge;
  const data = [];
  let balance = savings;
  for (let i = 0; i <= years; i++) {
    if (i > 0) {
      balance += income;
      balance *= 1 + returnRate;
    }
    data.push({ age: currentAge + i, balance: Math.round(balance) });
  }
  return data;
}

export function calculateBudgetAllocation({ income, taxRate, mortgage, other }) {
  income = Number(income);
  taxRate = Number(taxRate) / 100;
  mortgage = Number(mortgage);
  other = Number(other);
  const taxes = Math.round(income * taxRate);
  const leftover = income - taxes - mortgage - other;
  return { taxes, mortgage, other, leftover };
}

const PLANNING_KEY = 'planningData';
let planningCache = null;
let planningInitialized = false;

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

export function clearPlanningCache() {
  planningCache = null;
  planningInitialized = false;
}

export async function loadPlanningData() {
  const user = getCurrentUser?.();

  // Always try localStorage first
  let localData = {};
  const stored = localStorage.getItem(PLANNING_KEY);
  if (stored) {
    try {
      localData = JSON.parse(stored) || {};
    } catch (err) {
      console.warn('Failed to parse stored planning data:', err);
    }
  }

  // If not signed in, just return the local data
  if (!user) {
    planningCache = localData;
    return planningCache;
  }

  // Fetch the latest cloud data
  let cloudData = {};
  try {
    const snap = await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(PLANNING_KEY)
      .get();
    if (snap) {
      cloudData = snap.exists ? snap.data() : {};
    }
  } catch (err) {
    console.error('Failed to fetch planning data:', err);
  }

  // Merge cloud and local (local wins) and sync back
  planningCache = deepMerge(cloudData, localData);
  try {
    await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(PLANNING_KEY)
      .set(planningCache, { merge: true });
  } catch (err) {
    console.error('Failed to save planning data:', err);
  }

  localStorage.setItem(PLANNING_KEY, JSON.stringify(planningCache));
  return planningCache;
}

export async function savePlanningData(data) {
  planningCache = data || {};
  const user = getCurrentUser?.();
  localStorage.setItem(PLANNING_KEY, JSON.stringify(planningCache));
  if (!user) {
    return;
  }
  try {
    await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(PLANNING_KEY)
      .set(planningCache, { merge: true });
  } catch (err) {
    console.error('Failed to save planning data:', err);
  }
}

export async function initPlanningPanel() {
  const panel = document.getElementById('planningPanel');
  if (!panel || planningInitialized) return;
  planningInitialized = true;

  const saved = await loadPlanningData();
  let currentData = saved || {};
  currentData.finance = currentData.finance || {};
  currentData.assets = currentData.assets || {};
  currentData.budget = currentData.budget || {};
  currentData.history = currentData.history || [];

  const container = document.getElementById('planningContainer');
  container.innerHTML = `
    <form id="planningForm" class="planning-form">
      <label>Current Age <input type="number" name="curAge" placeholder="e.g. 30" value="${currentData.finance.curAge ?? ''}" /></label>
      <label>Retirement Age <input type="number" name="retAge" placeholder="e.g. 65" value="${currentData.finance.retAge ?? ''}" /></label>
      <label>Annual Income <input type="number" name="income" placeholder="e.g. 50000" value="${currentData.finance.income ?? ''}" /></label>
      <label>Return Rate % <input type="number" name="returnRate" placeholder="e.g. 5" value="${currentData.finance.returnRate ?? ''}" /></label>
      <label>Real Estate <input type="number" name="realEstate" placeholder="e.g. 300000" value="${currentData.assets.realEstate ?? ''}" /></label>
      <label>Car <input type="number" name="carValue" placeholder="e.g. 20000" value="${currentData.assets.carValue ?? ''}" /></label>
      <label>Savings <input type="number" name="assetSavings" placeholder="e.g. 10000" value="${currentData.assets.assetSavings ?? ''}" /></label>
      <label>Investment Accounts <input type="number" name="investment" placeholder="e.g. 50000" value="${currentData.assets.investment ?? ''}" /></label>
      <label>Tax Rate % <input type="number" name="taxRate" placeholder="e.g. 25" value="${currentData.budget.taxRate ?? ''}" /></label>
      <label>Mortgage/year <input type="number" name="mortgage" placeholder="e.g. 12000" value="${currentData.budget.mortgage ?? ''}" /></label>
      <label>Other Expenses <input type="number" name="other" placeholder="e.g. 5000" value="${currentData.budget.other ?? ''}" /></label>
    </form>
    <div class="note-text" style="margin-top:4px;">Values load once you're signed in.</div>
    <div id="assetsTotal" style="margin-top:1em;"></div>
    <div id="financeResult" style="margin-top:1em;"></div>
    <div id="budgetResult" style="margin-top:1em;"></div>
  `;

  const form = container.querySelector('#planningForm');
  const assetsTotalDiv = container.querySelector('#assetsTotal');
  const financeResultDiv = container.querySelector('#financeResult');
  const budgetResultDiv = container.querySelector('#budgetResult');

  function renderAll() {
    const values = {
      curAge: form.curAge.value,
      retAge: form.retAge.value,
      income: form.income.value,
      returnRate: form.returnRate.value,
      realEstate: Number(form.realEstate.value || 0),
      carValue: Number(form.carValue.value || 0),
      assetSavings: Number(form.assetSavings.value || 0),
      investment: Number(form.investment.value || 0),
      taxRate: form.taxRate.value,
      mortgage: form.mortgage.value,
      other: form.other.value
    };

    const assetTotal =
      values.realEstate + values.carValue + values.assetSavings + values.investment;
    assetsTotalDiv.textContent = `Total Assets: $${assetTotal.toLocaleString()}`;

    const finData = calculateFinanceProjection({
      currentAge: values.curAge,
      retirementAge: values.retAge,
      savings: assetTotal,
      income: values.income,
      returnRate: values.returnRate
    });
    financeResultDiv.innerHTML = '<table><thead><tr><th>Age</th><th>Balance</th></tr></thead><tbody>' +
      finData.map(r => `<tr><td>${r.age}</td><td>$${r.balance.toLocaleString()}</td></tr>`).join('') +
      '</tbody></table>';

    const budget = calculateBudgetAllocation({
      income: values.income,
      taxRate: values.taxRate,
      mortgage: values.mortgage,
      other: values.other
    });
    budgetResultDiv.innerHTML =
      `Taxes: $${budget.taxes.toLocaleString()}<br>` +
      `Mortgage: $${budget.mortgage.toLocaleString()}<br>` +
      `Other: $${budget.other.toLocaleString()}<br>` +
      `Leftover: $${budget.leftover.toLocaleString()}`;

    currentData.finance = {
      curAge: values.curAge,
      retAge: values.retAge,
      income: values.income,
      returnRate: values.returnRate
    };
    currentData.assets = {
      realEstate: values.realEstate,
      carValue: values.carValue,
      assetSavings: values.assetSavings,
      investment: values.investment
    };
    currentData.budget = {
      taxRate: values.taxRate,
      mortgage: values.mortgage,
      other: values.other
    };

    const hist = currentData.history;
    const today = new Date().toISOString().slice(0, 10);
    const last = hist[hist.length - 1];
    if (!last || last.date !== today) {
      hist.push({ date: today, age: values.curAge, balance: assetTotal });
    } else {
      last.age = values.curAge;
      last.balance = assetTotal;
    }

    savePlanningData(currentData);
  }

  form.addEventListener('input', renderAll);
  renderAll();
}

if (typeof window !== 'undefined') {
  window.initPlanningPanel = initPlanningPanel;
  window.clearPlanningCache = clearPlanningCache;
}
