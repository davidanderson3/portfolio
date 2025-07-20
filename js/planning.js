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
  const stored = localStorage.getItem(PLANNING_KEY);
  if (!user) {
    planningCache = stored ? JSON.parse(stored) : {};
    return planningCache;
  }
  if (stored) {
    try {
      const data = JSON.parse(stored);
      await db
        .collection('users').doc(user.uid)
        .collection('settings').doc(PLANNING_KEY)
        .set(data, { merge: true });
      localStorage.removeItem(PLANNING_KEY);
      planningCache = data;
      return planningCache;
    } catch (err) {
      console.warn('Failed to sync pending planning data:', err);
      try {
        planningCache = JSON.parse(stored);
        return planningCache;
      } catch {}
    }
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
  localStorage.setItem(PLANNING_KEY, JSON.stringify(planningCache));
  if (!user) {
    return;
  }
  try {
    await db
      .collection('users').doc(user.uid)
      .collection('settings').doc(PLANNING_KEY)
      .set(planningCache, { merge: true });
    localStorage.removeItem(PLANNING_KEY);
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
  currentData.profiles = currentData.profiles || [];

  const container = document.getElementById('planningContainer');
  container.innerHTML = `
    <h3>Profiles</h3>
    <button type="button" id="addProfile">+ Add Profile</button>
    <div id="profilesList" style="margin-top:1em;"></div>
    <h3 style="margin-top:2em;">Sources of Happiness</h3>
    <ul id="happySourcesList" style="margin-top:0;"></ul>
  `;

  const profilesDiv = container.querySelector('#profilesList');
  let profileCount = 0;

  function addProfile(initial = {}) {
    const index = profileCount++;
    const wrap = document.createElement('div');
    wrap.className = 'planning-profile';
    wrap.dataset.index = index;
    wrap.innerHTML = `
      <div class="profile-header">
        <input type="text" class="profile-name" placeholder="Profile Name" value="${initial.name ?? ''}" />
      </div>
      <form class="finance-form" style="display:flex;flex-direction:column;gap:4px;max-width:260px;">
        <label>Current Age <input type="number" name="curAge" value="${initial.finance?.curAge ?? 30}" /></label>
        <label>Retirement Age <input type="number" name="retAge" value="${initial.finance?.retAge ?? 65}" /></label>
        <label>Current Savings <input type="number" name="savings" value="${initial.finance?.savings ?? 0}" /></label>
        <label>Annual Income <input type="number" name="income" value="${initial.finance?.income ?? 50000}" /></label>
        <label>Annual Expenses <input type="number" name="expenses" value="${initial.finance?.expenses ?? 40000}" /></label>
        <label>Return Rate % <input type="number" name="returnRate" value="${initial.finance?.returnRate ?? 5}" /></label>
      </form>
      <div class="financeResult" style="margin-top:1em;"></div>
      <form class="happy-form" style="display:flex;flex-direction:column;gap:4px;max-width:260px;margin-top:1em;">
        <label>Hours on Hobbies/week <input type="number" name="hobbyHours" value="${initial.happiness?.hobbyHours ?? 10}" /></label>
        <label>Hours Working/week <input type="number" name="workHours" value="${initial.happiness?.workHours ?? 40}" /></label>
      </form>
      <div class="happyResult" style="margin-top:1em;"></div>
    `;

    const header = wrap.querySelector('.profile-header');
    const nameInput = wrap.querySelector('.profile-name');
    const delBtn = makeIconBtn('❌', 'Delete profile', () => {
      if (!confirm('Delete this profile?')) return;
      const idx = Number(wrap.dataset.index);
      profilesDiv.removeChild(wrap);
      currentData.profiles.splice(idx, 1);
      profileCount--;
      Array.from(profilesDiv.children).forEach((child, i) => {
        child.dataset.index = i;
      });
      savePlanningData(currentData);
    });
    header.appendChild(delBtn);

    const financeForm = wrap.querySelector('.finance-form');
    const financeResultDiv = wrap.querySelector('.financeResult');
    const happyForm = wrap.querySelector('.happy-form');
    const happyResultDiv = wrap.querySelector('.happyResult');

    function renderFinance() {
      const values = {
        currentAge: financeForm.curAge.value,
        retirementAge: financeForm.retAge.value,
        savings: financeForm.savings.value,
        income: financeForm.income.value,
        expenses: financeForm.expenses.value,
        returnRate: financeForm.returnRate.value
      };
      const data = calculateFinanceProjection(values);
      financeResultDiv.innerHTML = '<table><thead><tr><th>Age</th><th>Balance</th></tr></thead><tbody>' +
        data.map(r => `<tr><td>${r.age}</td><td>$${r.balance.toLocaleString()}</td></tr>`).join('') +
        '</tbody></table>';
      currentData.profiles[index] = currentData.profiles[index] || {};
      currentData.profiles[index].finance = { ...values };
      savePlanningData(currentData);
    }

    function renderHappiness() {
      const values = {
        hobbyHours: happyForm.hobbyHours.value,
        workHours: happyForm.workHours.value
      };
      const score = calculateHappinessScore(values);
      happyResultDiv.textContent = `Happiness Score: ${score}`;
      currentData.profiles[index] = currentData.profiles[index] || {};
      currentData.profiles[index].happiness = { ...values };
      savePlanningData(currentData);
    }

    nameInput.addEventListener('input', () => {
      currentData.profiles[index] = currentData.profiles[index] || {};
      currentData.profiles[index].name = nameInput.value;
      savePlanningData(currentData);
    });

    financeForm.addEventListener('input', renderFinance);
    happyForm.addEventListener('input', renderHappiness);

    if (initial.finance) renderFinance();
    if (initial.happiness) renderHappiness();

    profilesDiv.appendChild(wrap);
  }

  container.querySelector('#addProfile').addEventListener('click', () => addProfile());

  if (currentData.profiles.length) {
    currentData.profiles.forEach(p => addProfile(p));
  } else {
    addProfile();
  }

  const srcList = container.querySelector('#happySourcesList');
  if (srcList) {
    srcList.innerHTML = happinessSources.map(s => `<li>${s}</li>`).join('');
  }
}

if (typeof window !== 'undefined') {
  window.initPlanningPanel = initPlanningPanel;
}
