import { getCurrentUser, db } from './auth.js';

export function calculateFinanceProjection({
  currentAge,
  retirementAge,
  savings,
  annualSavings = 0,
  income = 0,
  returnRate,
  annualRaise = 0,
  high3 = 0,
  serviceYears = 0,
  socialSecurity = 0,
  postYears = 0,
  withdrawalRate = 4,
  inflationRate = 0
}) {
  currentAge = Number(currentAge);
  retirementAge = Number(retirementAge);
  savings = Number(savings);
  annualSavings = Number(annualSavings !== undefined ? annualSavings : income);
  returnRate = Number(returnRate) / 100;
  annualRaise = Number(annualRaise) / 100;
  high3 = Number(high3);
  serviceYears = Number(serviceYears);
  socialSecurity = Number(socialSecurity);
  postYears = Number(postYears);
  withdrawalRate = Number(withdrawalRate) / 100;
  inflationRate = Number(inflationRate) / 100;

  const data = [];
  let balance = savings;
  let contribution = annualSavings;
  let yearIncome = Number(income);
  const years = retirementAge - currentAge;
  for (let i = 0; i <= years; i++) {
    if (i > 0) {
      balance += contribution;
      balance *= 1 + returnRate;
      contribution *= 1 + annualRaise;
      yearIncome *= 1 + annualRaise;
    }
    data.push({
      age: currentAge + i,
      balance: Math.round(balance),
      income: Math.round(yearIncome),
      realIncome: Math.round(yearIncome / Math.pow(1 + inflationRate, i))
    });
  }

  const fersRate = retirementAge >= 62 && serviceYears >= 20 ? 0.011 : 0.01;
  const fers = Math.round(high3 * fersRate * serviceYears);

  let postBalance = balance;
  let withdrawalAmount = 0;
  for (let i = 1; i <= postYears; i++) {
    const age = retirementAge + i;
    postBalance *= 1 + returnRate;
    if (i === 1) {
      withdrawalAmount = postBalance * withdrawalRate;
    } else {
      withdrawalAmount *= 1.03; // increase withdrawals by 3% yearly
    }
    const withdrawal = Math.round(withdrawalAmount);
    postBalance -= withdrawal;
    const incomeYear = withdrawal + fers + socialSecurity;
    data.push({
      age,
      balance: Math.round(postBalance),
      income: Math.round(incomeYear),
      realIncome: Math.round(incomeYear / Math.pow(1 + inflationRate, years + i)),
      withdrawal,
      fers,
      socialSecurity
    });
  }

  return data;
}

export function calculateBudgetAllocation({ income, taxRate, mortgage }) {
  income = Number(income);
  taxRate = Number(taxRate) / 100;
  mortgage = Number(mortgage);
  const taxes = Math.round(income * taxRate);
  const leftover = income - taxes - mortgage;
  return { taxes, mortgage, leftover };
}

export function estimateSocialSecurity({ income = 0, currentAge = 0, retirementAge = 0 }) {
  income = Number(income);
  currentAge = Number(currentAge);
  retirementAge = Number(retirementAge);
  const years = Math.min(35, Math.max(0, retirementAge - currentAge));
  if (!income || years === 0) return 0;
  const averageIncome = (income * years) / 35;
  return Math.round(averageIncome * 0.4);
}

const PLANNING_KEY = 'planningData';
let planningCache = null;
let planningInitialized = false;
const DAILY_HISTORY_HOUR = 20; // hour of day to record snapshot

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

  const localTs = localData.lastUpdated || 0;
  const cloudTs = cloudData.lastUpdated || 0;
  const older = cloudTs >= localTs ? localData : cloudData;
  const newer = cloudTs >= localTs ? cloudData : localData;
  planningCache = deepMerge(older, newer);
  planningCache.lastUpdated = Math.max(localTs, cloudTs);
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
  planningCache = { ...(data || {}) };
  planningCache.lastUpdated = Date.now();
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
      <label>Net Income <input type="number" name="income" placeholder="e.g. 50000" value="${currentData.finance.income ?? ''}" /></label>
      <label>Annual Savings <input type="number" name="annualSavings" placeholder="e.g. 5000" value="${currentData.finance.annualSavings ?? ''}" /></label>
      <label>Annual Raise % <input type="number" name="annualRaise" placeholder="e.g. 3" value="${currentData.finance.annualRaise ?? ''}" /></label>
      <label>Inflation Rate % <input type="number" name="inflation" placeholder="e.g. 3" value="${currentData.finance.inflation ?? 0}" /></label>
      <label>Return Rate % <input type="number" name="returnRate" placeholder="e.g. 5" value="${currentData.finance.returnRate ?? ''}" /></label>
      <label>High-3 Salary <input type="number" name="high3" placeholder="e.g. 80000" value="${currentData.finance.high3 ?? ''}" /></label>
      <label>Service Years <input type="number" name="serviceYears" placeholder="e.g. 35" value="${currentData.finance.serviceYears ?? ''}" /></label>
      <label>Withdrawal Rate % <input type="number" name="withdrawalRate" placeholder="e.g. 4" value="${currentData.finance.withdrawalRate ?? 4}" /></label>
      <label>Post Years <input type="number" name="postYears" placeholder="e.g. 30" value="${currentData.finance.postYears ?? 30}" /></label>
      <label>Social Security <input type="number" name="socialSecurity" placeholder="e.g. 20000" value="${currentData.finance.socialSecurity ?? ''}" /></label>
      <div id="ssEstimate" style="margin-bottom:0.5em;font-style:italic"></div>
      <label>Real Estate <input type="number" name="realEstate" placeholder="e.g. 300000" value="${currentData.assets.realEstate ?? ''}" /></label>
      <label>Car <input type="number" name="carValue" placeholder="e.g. 20000" value="${currentData.assets.carValue ?? ''}" /></label>
      <label>Savings <input type="number" name="assetSavings" placeholder="e.g. 10000" value="${currentData.assets.assetSavings ?? ''}" /></label>
      <label>Checking <input type="number" name="checking" placeholder="e.g. 2000" value="${currentData.assets.checking ?? ''}" /></label>
      <label>Investment Accounts <input type="number" name="investment" placeholder="e.g. 50000" value="${currentData.assets.investment ?? ''}" /></label>
      <label>Roth IRA <input type="number" name="roth" placeholder="e.g. 10000" value="${currentData.assets.roth ?? ''}" /></label>
      <label>Crypto <input type="number" name="crypto" placeholder="e.g. 1000" value="${currentData.assets.crypto ?? ''}" /></label>
      <label>Rolling Credit <input type="number" name="rollingCredit" placeholder="e.g. 5000" value="${currentData.budget.rollingCredit ?? ''}" /></label>
    </form>
    <div id="assetsTotal" style="margin-top:1em;"></div>
    <div id="financeResult" style="margin-top:1em;"></div>
  `;

  const form = container.querySelector('#planningForm');
  const assetsTotalDiv = container.querySelector('#assetsTotal');
  const financeResultDiv = container.querySelector('#financeResult');
  const ssEstimateDiv = container.querySelector('#ssEstimate');

  function renderAll() {
    const values = {
      curAge: form.curAge.value,
      retAge: form.retAge.value,
      income: Number(form.income.value || 0),
      annualSavings: Number(form.annualSavings.value || 0),
      annualRaise: form.annualRaise.value,
      inflation: form.inflation.value,
      returnRate: form.returnRate.value,
      high3: Number(form.high3.value || 0),
      serviceYears: Number(form.serviceYears.value || 0),
      withdrawalRate: Number(form.withdrawalRate.value || 4),
      postYears: Number(form.postYears.value || 30),
      socialSecurity: Number(form.socialSecurity.value || 0),
      realEstate: Number(form.realEstate.value || 0),
      carValue: Number(form.carValue.value || 0),
      assetSavings: Number(form.assetSavings.value || 0),
      checking: Number(form.checking.value || 0),
      investment: Number(form.investment.value || 0),
      roth: Number(form.roth.value || 0),
      crypto: Number(form.crypto.value || 0),
      rollingCredit: form.rollingCredit.value,
      mortgage: 0
    };

    const estimatedSS = estimateSocialSecurity({
      income: values.income,
      currentAge: values.curAge,
      retirementAge: values.retAge
    });
    values.socialSecurity = values.socialSecurity || estimatedSS;
    ssEstimateDiv.textContent = values.socialSecurity === estimatedSS && estimatedSS
      ? `Estimated Social Security: $${estimatedSS.toLocaleString()}`
      : '';

    const assetTotal =
      values.realEstate + values.carValue + values.assetSavings + values.checking +
      values.investment + values.roth + values.crypto;
    assetsTotalDiv.textContent = `Total Assets: $${assetTotal.toLocaleString()}`;

      const finData = calculateFinanceProjection({
        currentAge: values.curAge,
        retirementAge: values.retAge,
        savings: assetTotal,
        income: values.income,
        annualSavings: values.annualSavings,
        annualRaise: values.annualRaise,
        inflationRate: values.inflation,
        returnRate: values.returnRate,
        high3: values.high3,
        serviceYears: values.serviceYears,
        socialSecurity: values.socialSecurity,
        postYears: values.postYears,
        withdrawalRate: values.withdrawalRate
      });
    financeResultDiv.innerHTML = '<table><thead><tr><th>Age</th><th>Balance</th><th>Income</th><th>Income (Today)</th><th>Withdrawals</th><th>FERS</th><th>Social Security</th></tr></thead><tbody>' +
      finData.map(r => `<tr><td>${r.age}</td><td>$${r.balance.toLocaleString()}</td><td>${r.income ? '$' + r.income.toLocaleString() : ''}</td><td>${r.realIncome ? '$' + r.realIncome.toLocaleString() : ''}</td><td>${r.withdrawal ? '$' + r.withdrawal.toLocaleString() : ''}</td><td>${r.fers ? '$' + r.fers.toLocaleString() : ''}</td><td>${r.socialSecurity ? '$' + r.socialSecurity.toLocaleString() : ''}</td></tr>`).join('') +
      '</tbody></table>';
    currentData.finance = {
      curAge: values.curAge,
      retAge: values.retAge,
      income: values.income,
      annualSavings: values.annualSavings,
      annualRaise: values.annualRaise,
      inflation: values.inflation,
      returnRate: values.returnRate,
      high3: values.high3,
      serviceYears: values.serviceYears,
      withdrawalRate: values.withdrawalRate,
      postYears: values.postYears,
      socialSecurity: values.socialSecurity
    };
    currentData.assets = {
      realEstate: values.realEstate,
      carValue: values.carValue,
      assetSavings: values.assetSavings,
      checking: values.checking,
      investment: values.investment,
      roth: values.roth,
      crypto: values.crypto
    };
    currentData.budget = {
      rollingCredit: values.rollingCredit
    };

    const hist = currentData.history;
    const last = hist[hist.length - 1];
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const schedulePassed = nowDate.getHours() >= DAILY_HISTORY_HOUR;
    let addSnapshot = false;
    if (!last) {
      addSnapshot = true;
    } else {
      const lastDate = new Date(last.timestamp);
      const sameDay = lastDate.toDateString() === nowDate.toDateString();
      const needDaily = schedulePassed && (!sameDay || lastDate.getHours() < DAILY_HISTORY_HOUR);
      if (last.balance !== assetTotal || needDaily) {
        addSnapshot = true;
      }
    }
    if (addSnapshot) {
      hist.push({ timestamp: nowIso, age: values.curAge, balance: assetTotal });
    } else if (last) {
      last.timestamp = nowIso;
      last.age = values.curAge;
    }

    savePlanningData(currentData);
  }

  form.addEventListener('input', renderAll);
  form.addEventListener('change', renderAll);
  renderAll();
}

if (typeof window !== 'undefined') {
  window.initPlanningPanel = initPlanningPanel;
  window.clearPlanningCache = clearPlanningCache;
}
