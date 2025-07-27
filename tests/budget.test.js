import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMock = vi.fn();
const getMock = vi.fn();

// Simple localStorage mock
const storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = storage;

function createAuthMock() {
  const docFn = vi.fn(() => ({
    collection: collectionFn,
    doc: docFn,
    get: getMock,
    set: setMock
  }));
  function collectionFn() { return { doc: docFn }; }
  return {
    getCurrentUser: () => ({ uid: 'u1' }),
    db: { collection: collectionFn }
  };
}

vi.mock('../js/auth.js', createAuthMock);

import { getTaxRates, calculateMonthlyBudget } from '../js/budget.js';

beforeEach(() => {
  setMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  vi.doMock('../js/auth.js', createAuthMock);
  localStorage.clear();
});

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
        'Amazon Prime': 15,
        tolls: 30,
        tsp: 300,
        dentalInsurance: 50
      }
    });
    const expectedExpenses = 1500 + 500 + 15 + 30 + 50 + 300 + 2100;
    expect(res.federalTax).toBe(1000);
    expect(res.stateTax).toBe(1100);
    expect(res.tax).toBe(2100);
    expect(res.netPay).toBe(7900);
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.monthlyIncome).toBe(10000);
    expect(res.leftover).toBe(10000 - expectedExpenses);
  });
});

describe('budget persistence', () => {
  it('loads data from Firestore', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ state: 'CA' }) });
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res).toEqual({ state: 'CA', subscriptions: {} });
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { saveBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ city: 'SF' });
    expect(setMock).toHaveBeenCalledWith({ city: 'SF', subscriptions: {} }, { merge: true });
    expect(JSON.parse(localStorage.getItem('budgetConfig'))).toEqual({ city: 'SF', subscriptions: {} });
  });

  it('uses localStorage when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const { saveBudgetData, loadBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ city: 'Austin' });
    expect(JSON.parse(localStorage.getItem('budgetConfig'))).toEqual({ city: 'Austin', subscriptions: {} });
    const data = await loadBudgetData();
    expect(data).toEqual({ city: 'Austin', subscriptions: {} });
  });

  it('deep merges cloud and local data', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ city: 'Dallas', state: 'TX' }) });
    localStorage.setItem('budgetConfig', JSON.stringify({ state: 'TX', escrow: 100 }));
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res).toEqual({ state: 'TX', city: 'Dallas', escrow: 100, subscriptions: {} });
  });
});
