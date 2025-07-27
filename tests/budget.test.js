import { describe, it, expect, vi, beforeEach } from 'vitest';

let planningMock = { finance: { income: 0 } };
vi.mock('../js/planning.js', () => ({ loadPlanningData: () => planningMock }));

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

import { getTaxRates, calculateMonthlyBudget, calculateCurrentMonthlyBudget } from '../js/budget.js';

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

  it('uses provided net pay', () => {
    const res = calculateMonthlyBudget({
      netPay: 6000,
      state: 'CA',
      city: 'Los Angeles',
      categories: { prime: 15, tolls: 30 }
    });
    const expectedExpenses = 15 + 30;
    expect(res.tax).toBe(0);
    expect(res.netPay).toBe(6000);
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.leftover).toBe(6000 - expectedExpenses);
  });

  it('calculates the current monthly budget from saved data', async () => {
    planningMock = { finance: { income: 120000 } };
    const stored = {
      state: 'CA',
      city: 'Los Angeles',
      subscriptions: { Netflix: 15 },
      tsp: 300
    };
    localStorage.setItem('budgetConfig', JSON.stringify(stored));
    const res = await calculateCurrentMonthlyBudget();
    // net income after tax: 7900 (from salary 120000 -> monthly 10000, tax 2100)
    // expenses: tsp + subscription
    const expectedExpenses = 300 + 15 + 2100;
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.leftover).toBe(10000 - expectedExpenses);
  });
});

describe('budget persistence', () => {
  it('loads data from Firestore', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ state: 'CA' }) });
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.state).toBe('CA');
    expect(res.subscriptions).toEqual({});
    expect(typeof res.lastUpdated).toBe('number');
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { saveBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ city: 'SF' });
    const saved = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(saved.city).toBe('SF');
    expect(saved.subscriptions).toEqual({});
    expect(typeof saved.lastUpdated).toBe('number');
    expect(setMock).toHaveBeenCalledWith(saved, { merge: true });
  });

  it('uses localStorage when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const { saveBudgetData, loadBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ city: 'Austin' });
    const stored = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(stored.city).toBe('Austin');
    expect(typeof stored.lastUpdated).toBe('number');
    const data = await loadBudgetData();
    expect(data.city).toBe('Austin');
  });

  it('prefers newer data source when merging', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ city: 'Dallas', state: 'TX', lastUpdated: 200 }) });
    localStorage.setItem('budgetConfig', JSON.stringify({ state: 'TX', escrow: 100, lastUpdated: 100 }));
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.city).toBe('Dallas');
    expect(res.escrow).toBe(100);
    expect(res.lastUpdated).toBe(200);
  });
});
