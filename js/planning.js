import { getCurrentUser, db } from './auth.js';
import { makeIconBtn } from './helpers.js';

export function calculateFinanceProjection({ currentAge, retirementAge, savings, income, expenses, returnRate }) {
  currentAge = Number(currentAge);
  retirementAge = Number(retirementAge);
  savings = Number(savings);
  income = Number(income);
  expenses = Number(expenses);
  returnRate = Number(returnRate) / 100;
  const years = retirementAge - currentAge;
  const data = [];
  let balance = savings;
  for (let i = 0; i <= years; i++) {
    if (i > 0) {
      balance += income - expenses;
      balance *= 1 + returnRate;
    }
    data.push({ age: currentAge + i, balance: Math.round(balance) });
  }
  return data;
}

export function calculateHappinessScore({ hobbyHours, workHours }) {
  hobbyHours = Number(hobbyHours);
  workHours = Number(workHours);
  return Math.round(hobbyHours * 2 - workHours);
}

export const happinessSources = [
  'Family',
  'Friends',
  'Health',
  'Hobbies',
  'Learning',
  'Helping others'
];

const PLANNING_KEY = 'planningData';
let planningCache = null;
let planningInitialized = false;

export async function loadPlanningData() {
  if (planningCache) return planningCache;
  const user = getCurrentUser?.();
  if (!user) {
    const stored = localStorage.getItem(PLANNING_KEY);
    planningCache = stored ? JSON.parse(stored) : {};
    return planningCache;
  }
  const snap = await db
    .collection('users').doc(user.uid)
    .collection('settings').doc(PLANNING_KEY)
    .get();
  planningCache = snap.exists ? snap.data() : {};
  return planningCache;
}

export async function savePlanningData(data) {
  planningCache = data || {};
  const user = getCurrentUser?.();
  if (!user) {
    localStorage.setItem(PLANNING_KEY, JSON.stringify(planningCache));
    return;
  }
  await db
    .collection('users').doc(user.uid)
    .collection('settings').doc(PLANNING_KEY)
    .set(planningCache, { merge: true });
}

export async function initPlanningPanel() {
  const panel = document.getElementById('planningPanel');
  if (!panel || planningInitialized) return;
  planningInitialized = true;

  const saved = await loadPlanningData();
  let currentData = saved || {};

  const container = document.getElementById('planningContainer');
  container.innerHTML = `
    <h3>Financial Profiles</h3>
    <button type="button" id="addFinanceProfile">+ Add Profile</button>
    <div id="financeProfiles" style="margin-top:1em;"></div>
    <h3 style="margin-top:2em;">Happiness Projection</h3>
    <form id="happyForm" style="display:flex;flex-direction:column;gap:4px;max-width:260px;">
      <label>Hours on Hobbies/week <input type="number" id="hobbyHours" value="10" /></label>
      <label>Hours Working/week <input type="number" id="workHours" value="40" /></label>
      <button type="submit">Calculate</button>
    </form>
    <div id="happyResult" style="margin-top:1em;"></div>
    <h3 style="margin-top:2em;">Sources of Happiness</h3>
    <ul id="happySourcesList" style="margin-top:0;"></ul>
  `;

  const profilesDiv = container.querySelector('#financeProfiles');
  let profileCount = 0;

  function addFinanceProfile(initial = {}) {
    const index = profileCount++;
    const wrap = document.createElement('div');
    wrap.className = 'finance-profile';
    wrap.dataset.index = index;
    wrap.innerHTML = `
      <div class="profile-header"><h4>Profile ${index + 1}</h4></div>
      <form style="display:flex;flex-direction:column;gap:4px;max-width:260px;">
        <label>Current Age <input type="number" name="curAge" value="${initial.curAge ?? 30}" /></label>
        <label>Retirement Age <input type="number" name="retAge" value="${initial.retAge ?? 65}" /></label>
        <label>Current Savings <input type="number" name="savings" value="${initial.savings ?? 0}" /></label>
        <label>Annual Income <input type="number" name="income" value="${initial.income ?? 50000}" /></label>
        <label>Annual Expenses <input type="number" name="expenses" value="${initial.expenses ?? 40000}" /></label>
        <label>Return Rate % <input type="number" name="returnRate" value="${initial.returnRate ?? 5}" /></label>
        <button type="submit">Calculate</button>
      </form>
      <div class="financeResult" style="margin-top:1em;"></div>
    `;
    const header = wrap.querySelector('.profile-header');
    const delBtn = makeIconBtn('❌', 'Delete profile', () => {
      if (!confirm('Delete this profile?')) return;
      const idx = Number(wrap.dataset.index);
      profilesDiv.removeChild(wrap);
      currentData.financeProfiles.splice(idx, 1);
      profileCount--;
      Array.from(profilesDiv.children).forEach((child, i) => {
        child.dataset.index = i;
        child.querySelector('h4').textContent = `Profile ${i + 1}`;
      });
      savePlanningData(currentData);
    });
    header.appendChild(delBtn);
    const form = wrap.querySelector('form');
    const resultDiv = wrap.querySelector('.financeResult');

    function renderResult(values) {
      const data = calculateFinanceProjection(values);
      resultDiv.innerHTML = '<table><thead><tr><th>Age</th><th>Balance</th></tr></thead><tbody>' +
        data.map(r => `<tr><td>${r.age}</td><td>$${r.balance.toLocaleString()}</td></tr>`).join('') +
        '</tbody></table>';
    }

    if (Object.keys(initial).length) {
      renderResult({
        currentAge: initial.curAge,
        retirementAge: initial.retAge,
        savings: initial.savings,
        income: initial.income,
        expenses: initial.expenses,
        returnRate: initial.returnRate
      });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const values = {
        curAge: form.curAge.value,
        retAge: form.retAge.value,
        savings: form.savings.value,
        income: form.income.value,
        expenses: form.expenses.value,
        returnRate: form.returnRate.value
      };
      renderResult({
        currentAge: values.curAge,
        retirementAge: values.retAge,
        savings: values.savings,
        income: values.income,
        expenses: values.expenses,
        returnRate: values.returnRate
      });
      currentData.financeProfiles[index] = values;
      savePlanningData(currentData);
    });

    profilesDiv.appendChild(wrap);
  }
  container.querySelector('#addFinanceProfile').addEventListener('click', addFinanceProfile);
  addFinanceProfile();
  addFinanceProfile();
  const financeForm = container.querySelector('#financeForm');
  const financeResult = container.querySelector('#financeResult');
  if (financeForm) {
    if (saved.finance) {
      financeForm.curAge.value = saved.finance.curAge ?? financeForm.curAge.value;
      financeForm.retAge.value = saved.finance.retAge ?? financeForm.retAge.value;
      financeForm.savings.value = saved.finance.savings ?? financeForm.savings.value;
      financeForm.income.value = saved.finance.income ?? financeForm.income.value;
      financeForm.expenses.value = saved.finance.expenses ?? financeForm.expenses.value;
      financeForm.returnRate.value = saved.finance.returnRate ?? financeForm.returnRate.value;
    }
    financeForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = {
        currentAge: financeForm.curAge.value,
        retirementAge: financeForm.retAge.value,
        savings: financeForm.savings.value,
        income: financeForm.income.value,
        expenses: financeForm.expenses.value,
        returnRate: financeForm.returnRate.value
      };
      const data = calculateFinanceProjection(input);
      financeResult.innerHTML = '<table><thead><tr><th>Age</th><th>Balance</th></tr></thead><tbody>' +
        data.map(r => `<tr><td>${r.age}</td><td>$${r.balance.toLocaleString()}</td></tr>`).join('') +
        '</tbody></table>';
      currentData = { ...currentData, finance: input };
      savePlanningData(currentData);
    });
  }
  currentData.financeProfiles = currentData.financeProfiles || [];
  container.querySelector('#addFinanceProfile').addEventListener('click', () => {
    addFinanceProfile();
  });

  if (currentData.financeProfiles.length) {
    currentData.financeProfiles.forEach(p => addFinanceProfile(p));
  } else {
    addFinanceProfile();
    addFinanceProfile();
  }

  const happyForm = container.querySelector('#happyForm');
  const happyResult = container.querySelector('#happyResult');
  if (saved.happiness) {
    happyForm.hobbyHours.value = saved.happiness.hobbyHours ?? happyForm.hobbyHours.value;
    happyForm.workHours.value = saved.happiness.workHours ?? happyForm.workHours.value;
  }
  happyForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = {
      hobbyHours: happyForm.hobbyHours.value,
      workHours: happyForm.workHours.value
    };
    const score = calculateHappinessScore(input);
    happyResult.textContent = `Happiness Score: ${score}`;
    currentData = { ...currentData, happiness: input };
    savePlanningData(currentData);
  });

  const srcList = container.querySelector('#happySourcesList');
  if (srcList) {
    srcList.innerHTML = happinessSources.map(s => `<li>${s}</li>`).join('');
  }
}

if (typeof window !== 'undefined') {
  window.initPlanningPanel = initPlanningPanel;
}
