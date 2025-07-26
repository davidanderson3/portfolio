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

export async function initBudgetPanel() {
  const panel = document.getElementById('budgetPanel');
  if (!panel) return;
  const planning = await loadPlanningData();
  const salary = Number(planning?.finance?.income || 0);
  panel.innerHTML = `
    <form id="budgetForm" class="planning-form">
      <div>Annual Salary: <span id="budgetSalary">$${salary.toLocaleString()}</span></div>
      <label>State <input type="text" name="state" /></label>
      <label>City <input type="text" name="city" /></label>
      <label>Housing <input type="number" name="housing" /></label>
      <label>Utilities <input type="number" name="utilities" /></label>
      <label>Food <input type="number" name="food" /></label>
      <label>Transportation <input type="number" name="transport" /></label>
      <label>Insurance <input type="number" name="insurance" /></label>
      <label>Healthcare <input type="number" name="healthcare" /></label>
      <label>Savings <input type="number" name="savings" /></label>
      <label>Entertainment <input type="number" name="entertainment" /></label>
      <label>Misc <input type="number" name="misc" /></label>
    </form>
    <div id="budgetSummary" style="margin-top:1em;"></div>
  `;

  const form = panel.querySelector('#budgetForm');
  const summary = panel.querySelector('#budgetSummary');
  function render() {
    const categories = {
      housing: form.housing.value,
      utilities: form.utilities.value,
      food: form.food.value,
      transport: form.transport.value,
      insurance: form.insurance.value,
      healthcare: form.healthcare.value,
      savings: form.savings.value,
      entertainment: form.entertainment.value,
      misc: form.misc.value
    };
    const state = form.state.value.trim();
    const city = form.city.value.trim();
    const result = calculateMonthlyBudget({ salary, state, city, categories });
    summary.innerHTML =
      `Taxes: $${result.tax.toLocaleString()}<br>` +
      `Total Expenses: $${result.expenses.toLocaleString()}<br>` +
      `Leftover: $${result.leftover.toLocaleString()}`;
  }
  form.addEventListener('input', render);
  render();
}

if (typeof window !== 'undefined') {
  window.initBudgetPanel = initBudgetPanel;
}
