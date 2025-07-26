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
  const tax = Math.round(salary * (FEDERAL_TAX_RATE + stateRate + cityRate) / 12);
  const monthlyIncome = salary / 12;
  const expenses = Object.values(cats).reduce((s, v) => s + v, 0) + tax;
  const leftover = monthlyIncome - expenses;
  return { tax, monthlyIncome, expenses, leftover };
}

import { loadPlanningData } from './planning.js';

const BUDGET_KEY = 'budgetConfig';

function loadBudgetData() {
  try {
    return JSON.parse(localStorage.getItem(BUDGET_KEY)) || {};
  } catch (err) {
    console.warn('Failed to parse budget data:', err);
    return {};
  }
}

function saveBudgetData(data) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(data));
}

export async function initBudgetPanel() {
  const panel = document.getElementById('budgetPanel');
  if (!panel) return;
  const planning = await loadPlanningData();
  const salary = Number(planning?.finance?.income || 0);
  const saved = loadBudgetData();
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
        <label>Transportation <input type="number" name="transport" value="${saved.transport ?? ''}" /></label>
        <label>Insurance <input type="number" name="insurance" value="${saved.insurance ?? ''}" /></label>
        <label>Health Insurance <input type="number" name="healthInsurance" value="${saved.healthInsurance ?? ''}" /></label>
        <label>Healthcare <input type="number" name="healthcare" value="${saved.healthcare ?? ''}" /></label>
        <label>Savings <input type="number" name="savings" value="${saved.savings ?? ''}" /></label>

        <div class="section-title">Entertainment</div>
        <label>Amazon Prime <input type="number" name="prime" value="${saved.prime ?? ''}" /></label>
        <label>Spotify <input type="number" name="spotify" value="${saved.spotify ?? ''}" /></label>

        <div class="section-title">Other Spending</div>
        <label>Misc <input type="number" name="misc" value="${saved.misc ?? ''}" /></label>
      </form>
      <div id="budgetSummary" class="budget-summary"></div>
    </div>
  `;

  const form = panel.querySelector('#budgetForm');
  const summary = panel.querySelector('#budgetSummary');
  function render() {
    const fields = ['mortgageInterest', 'mortgagePrincipal', 'escrow', 'electric', 'water', 'gas', 'internet', 'cell', 'food', 'transport', 'insurance', 'healthInsurance', 'healthcare', 'savings', 'prime', 'spotify', 'misc'];
    const categories = {};
    fields.forEach(f => { categories[f] = form[f].value; });
    const state = form.state.value.trim();
    const city = form.city.value.trim();
    const result = calculateMonthlyBudget({ salary, state, city, categories });
    summary.innerHTML =
      `Taxes: $${result.tax.toLocaleString()}<br>` +
      `Total Expenses: $${result.expenses.toLocaleString()}<br>` +
      `Leftover: $${result.leftover.toLocaleString()}`;
    const saveData = { state, city };
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
