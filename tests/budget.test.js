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
      categories: { housing: 2000, food: 500 }
    });
    // tax = (120000*(0.1+0.09+0.02))/12 = 2100
    expect(res.tax).toBe(2100);
    const expectedExpenses = 2000 + 500 + 2100;
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.monthlyIncome).toBe(10000);
    expect(res.leftover).toBe(10000 - expectedExpenses);
  });
});
