import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));

import { getTaxRates, calculateMonthlyBudget } from '../js/budget.js';

describe('budget calculations', () => {
  it('returns tax rates for state and city', () => {
    const rates = getTaxRates('CA', 'Los Angeles');
    expect(rates).toEqual({ stateRate: 0.09, cityRate: 0.02 });
  });

  it('calculates monthly budget', () => {
    const res = calculateMonthlyBudget({
      salary: 120000,
      state: 'CA',
      city: 'Los Angeles',
      categories: {
        mortgagePrincipal: 1500,
        mortgageInterest: 500,
        prime: 15,
        tolls: 30,
        dentalInsurance: 50
      }
    });
    // federal = (120000*0.1)/12 = 1000
    // state + city = (120000*(0.09+0.02))/12 = 1100
    expect(res.federalTax).toBe(1000);
    expect(res.stateTax).toBe(1100);
    expect(res.tax).toBe(2100);
    const expectedExpenses = 1500 + 500 + 15 + 30 + 50 + 2100;
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.monthlyIncome).toBe(10000);
    expect(res.leftover).toBe(10000 - expectedExpenses);
  });
});
