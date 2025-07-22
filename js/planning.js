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
  planningCache = { ...cloudData, ...localData };
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
  currentData.profiles = currentData.profiles || [];
  currentData.assets = currentData.assets || {};

  const container = document.getElementById('planningContainer');
  container.innerHTML = `
    <h3>Assets</h3>
    <form id="assetsForm" style="display:flex;flex-direction:column;gap:4px;max-width:260px;">
      <label>Real Estate <input type="number" name="realEstate" placeholder="e.g. 300000" value="${currentData.assets.realEstate ?? ''}" /></label>
      <label>Car <input type="number" name="carValue" placeholder="e.g. 20000" value="${currentData.assets.carValue ?? ''}" /></label>
      <label>Savings <input type="number" name="assetSavings" placeholder="e.g. 10000" value="${currentData.assets.assetSavings ?? ''}" /></label>
      <label>Investment Accounts <input type="number" name="investment" placeholder="e.g. 50000" value="${currentData.assets.investment ?? ''}" /></label>
    </form>
    <div id="assetsTotal" style="margin-top:1em;"></div>
    <h3 style="margin-top:2em;">Profiles</h3>
    <button type="button" id="addProfile">+ Add Profile</button>
    <div class="note-text" style="margin-top:4px;">Values load once you're signed in.</div>
    <div id="profilesList" style="margin-top:1em;"></div>
    <h3 style="margin-top:2em;">Sources of Happiness</h3>
    <ul id="happySourcesList" style="margin-top:0;"></ul>
  `;

  const profilesDiv = container.querySelector('#profilesList');
  let profileCount = 0;
  let assetsForm;
  let assetsTotalDiv;

  function addProfile(initial = {}) {
    const index = profileCount++;
    const wrap = document.createElement('div');
    wrap.className = 'planning-profile';
    wrap.dataset.index = index;
    wrap.innerHTML = `
      <div class="profile-header">
        <input type="text" class="profile-name" placeholder="e.g. Alex" value="${initial.name ?? ''}" />
      </div>
      <form class="finance-form" style="display:flex;flex-direction:column;gap:4px;max-width:260px;">
        <label>Current Age <input type="number" name="curAge" placeholder="e.g. 30" value="${initial.finance?.curAge ?? ''}" /></label>
        <label>Retirement Age <input type="number" name="retAge" placeholder="e.g. 65" value="${initial.finance?.retAge ?? ''}" /></label>
        <label>Annual Income <input type="number" name="income" placeholder="e.g. 50000" value="${initial.finance?.income ?? ''}" /></label>
        <label>Annual Expenses <input type="number" name="expenses" placeholder="e.g. 40000" value="${initial.finance?.expenses ?? ''}" /></label>
        <label>Return Rate % <input type="number" name="returnRate" placeholder="e.g. 5" value="${initial.finance?.returnRate ?? ''}" /></label>
      </form>
      <div class="financeResult" style="margin-top:1em;"></div>
      <form class="happy-form" style="display:flex;flex-direction:column;gap:4px;max-width:260px;margin-top:1em;">
        <label>Hours on Hobbies/week <input type="number" name="hobbyHours" placeholder="e.g. 10" value="${initial.happiness?.hobbyHours ?? ''}" /></label>
        <label>Hours Working/week <input type="number" name="workHours" placeholder="e.g. 40" value="${initial.happiness?.workHours ?? ''}" /></label>
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
        curAge: financeForm.curAge.value,
        retAge: financeForm.retAge.value,
        income: financeForm.income.value,
        expenses: financeForm.expenses.value,
        returnRate: financeForm.returnRate.value
      };

      const assetVals = assetsForm ? {
        realEstate: Number(assetsForm.realEstate.value || 0),
        carValue: Number(assetsForm.carValue.value || 0),
        assetSavings: Number(assetsForm.assetSavings.value || 0),
        investment: Number(assetsForm.investment.value || 0)
      } : {
        realEstate: Number(currentData.assets.realEstate || 0),
        carValue: Number(currentData.assets.carValue || 0),
        assetSavings: Number(currentData.assets.assetSavings || 0),
        investment: Number(currentData.assets.investment || 0)
      };

      const assetTotal =
        assetVals.realEstate + assetVals.carValue + assetVals.assetSavings + assetVals.investment;

      const data = calculateFinanceProjection({
        currentAge: values.curAge,
        retirementAge: values.retAge,
        savings: assetTotal,
        income: values.income,
        expenses: values.expenses,
        returnRate: values.returnRate
      });
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

  assetsForm = container.querySelector('#assetsForm');
  assetsTotalDiv = container.querySelector('#assetsTotal');
  if (assetsForm && assetsTotalDiv) {
    function renderAssets() {
      const values = {
        realEstate: Number(assetsForm.realEstate.value || 0),
        carValue: Number(assetsForm.carValue.value || 0),
        assetSavings: Number(assetsForm.assetSavings.value || 0),
        investment: Number(assetsForm.investment.value || 0)
      };
      const total =
        values.realEstate + values.carValue + values.assetSavings + values.investment;
      assetsTotalDiv.textContent = `Total Assets: $${total.toLocaleString()}`;
      currentData.assets = { ...values };
      savePlanningData(currentData);
      if (typeof window !== 'undefined' && window.Event) {
        document.querySelectorAll('.finance-form').forEach(f => {
          f.dispatchEvent(new window.Event('input', { bubbles: true }));
        });
      }
    }
    assetsForm.addEventListener('input', renderAssets);
    renderAssets();
  }
}

if (typeof window !== 'undefined') {
  window.initPlanningPanel = initPlanningPanel;
  window.clearPlanningCache = clearPlanningCache;
}
