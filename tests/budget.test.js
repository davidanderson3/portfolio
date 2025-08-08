import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

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
    db: { collection: collectionFn },
    auth: { onAuthStateChanged: vi.fn() }
  };
}

vi.mock('../js/auth.js', createAuthMock);

import { calculateMonthlyBudget, calculateCurrentMonthlyBudget } from '../js/budget.js';

beforeEach(() => {
  setMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  vi.doMock('../js/auth.js', createAuthMock);
  localStorage.clear();
});

describe('budget calculations', () => {
  it('calculates monthly budget', () => {
    const res = calculateMonthlyBudget({
      salary: 120000,
      categories: {
        mortgagePrincipal: 1500,
        mortgageInterest: 500,
        'Amazon Prime': 15,
        tolls: 30,
        tsp: 300,
        dentalInsurance: 50
      }
    });
    const expectedExpenses = 1500 + 500 + 15 + 30 + 300 + 50;
    expect(res.federalTax).toBe(1000);
    expect(res.tax).toBe(1000);
    expect(res.netPay).toBe(9000);
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.monthlyIncome).toBe(10000);
    expect(res.leftover).toBe(7605);
  });

  it('uses provided gross pay', () => {
    const res = calculateMonthlyBudget({
      netPay: 6000,
      categories: { prime: 15, tolls: 30 }
    });
    const expectedExpenses = 15 + 30; // tax excluded
    expect(res.tax).toBe(600);
    expect(res.netPay).toBe(5400);
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.leftover).toBe(5955);
  });

  it('calculates the current monthly budget from saved data', async () => {
    planningMock = { finance: { income: 120000 } };
    const stored = {
      subscriptions: { Netflix: 15 },
      tsp: 300
    };
    localStorage.setItem('budgetConfig', JSON.stringify(stored));
    const res = await calculateCurrentMonthlyBudget();
    const expectedExpenses = 300 + 15;
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.leftover).toBe(9685);
  });
});

describe('budget persistence', () => {
  it('loads data from Firestore', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ escrow: 50 }) });
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.escrow).toBe(50);
    expect(res.subscriptions).toEqual({});
    expect(res.recurring).toEqual({});
    expect(res.goalSubscriptions).toEqual({});
    expect(res.goalRecurring).toEqual({});
    expect(typeof res.lastUpdated).toBe('number');
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { saveBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ escrow: 75 });
    const saved = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(saved.escrow).toBe(75);
    expect(saved.subscriptions).toEqual({});
    expect(saved.recurring).toEqual({});
    expect(saved.goalSubscriptions).toEqual({});
    expect(saved.goalRecurring).toEqual({});
    expect(typeof saved.lastUpdated).toBe('number');
    expect(setMock).toHaveBeenCalledWith(saved, { merge: true });
  });

  it('uses localStorage when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {}, auth: { onAuthStateChanged: vi.fn() } }));
    const { saveBudgetData, loadBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ escrow: 80 });
    const stored = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(stored.escrow).toBe(80);
    expect(typeof stored.lastUpdated).toBe('number');
    const data = await loadBudgetData();
    expect(data.escrow).toBe(80);
    expect(data.recurring).toEqual({});
    expect(data.goalSubscriptions).toEqual({});
    expect(data.goalRecurring).toEqual({});
  });

  it('prefers newer data source when merging', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ lastUpdated: 200 }) });
    localStorage.setItem('budgetConfig', JSON.stringify({ escrow: 100, lastUpdated: 100 }));
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.escrow).toBeUndefined();
    expect(res.lastUpdated).toBe(200);
  });

  it('does not resurrect deleted entries from older data', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ escrow: 50, lastUpdated: 100 }) });
    localStorage.setItem('budgetConfig', JSON.stringify({ lastUpdated: 200 }));
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.escrow).toBeUndefined();
    expect(res.lastUpdated).toBe(200);
  });

  it('preserves existing fields in Firestore', async () => {
    let remote = { custom: 'keep' };
    setMock.mockImplementation((data, opts) => {
      remote = opts && opts.merge ? { ...remote, ...data } : data;
      return Promise.resolve();
    });
    getMock.mockImplementation(() => Promise.resolve({ exists: true, data: () => remote }));

    const { saveBudgetData, loadBudgetData } = await import('../js/budget.js');

    await saveBudgetData({ escrow: 50 });
    expect(remote.custom).toBe('keep');
    expect(remote.escrow).toBe(50);

    await saveBudgetData({ escrow: 75 });
    expect(remote.custom).toBe('keep');
    expect(remote.escrow).toBe(75);

    const result = await loadBudgetData();
    expect(result.escrow).toBe(75);
    expect(remote.custom).toBe('keep');
  });
});

describe('budget panel', () => {
  it('saves goal recurring expenses', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    document.getElementById('addCategoryBtn').click();

    const nameInput = document.querySelector('#recurContainerB .recurring-row:last-child .recur-name');
    const costInput = document.querySelector('#recurContainerB .recurring-row:last-child .recur-cost');
    nameInput.value = 'Test Recurring';
    costInput.value = '50';
      nameInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      costInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      // Changes are persisted on change events rather than every keystroke.
      nameInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      costInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    await new Promise(res => setTimeout(res, 0));

    const saved = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(saved.goalRecurring).toEqual({ 'Test Recurring': '50' });
    expect(setMock).toHaveBeenCalled();
  });

  it('reorders categories with the up button', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    document.getElementById('addCategoryBtn').click();
    document.getElementById('addCategoryBtn').click();

    const rows = document.querySelectorAll('#recurContainerA .recurring-row');
    rows[0].querySelector('.recur-name').value = 'First';
    rows[1].querySelector('.recur-name').value = 'Second';

    rows[1].querySelector('button[title="Move up"]').click();

    const order = Array.from(document.querySelectorAll('#recurContainerA .recurring-row .recur-name')).map(el => el.value);
    expect(order[0]).toBe('Second');
  });
});
