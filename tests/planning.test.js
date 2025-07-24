
import { calculateFinanceProjection, calculateBudgetAllocation } from '../js/planning.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('planning calculations', () => {
  it('projects finances over years', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 32,
      savings: 1000,
      income: 100,
      expenses: 50,
      returnRate: 0
    });
    expect(res).toEqual([
      { age: 30, balance: 1000 },
      { age: 31, balance: 1050 },
      { age: 32, balance: 1100 }
    ]);
  });

  it('calculates budget allocation', () => {
    const res = calculateBudgetAllocation({ income: 1000, taxRate: 10, mortgage: 300, other: 200 });
    expect(res).toEqual({ taxes: 100, mortgage: 300, other: 200, leftover: 400 });
  });
});

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

vi.mock('../js/auth.js', () => {
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
});

beforeEach(() => {
  setMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  localStorage.clear();
});

describe('planning persistence', () => {
  it('loads data from Firestore', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ finance: { curAge: '30' } }) });
    const { loadPlanningData } = await import('../js/planning.js');
    const res = await loadPlanningData();
    expect(res).toEqual({ finance: { curAge: '30' } });
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { savePlanningData } = await import('../js/planning.js');
    await savePlanningData({ finance: { curAge: '30' } });
    expect(setMock).toHaveBeenCalledWith({ finance: { curAge: '30' } }, { merge: true });
    expect(JSON.parse(localStorage.getItem('planningData'))).toEqual({ finance: { curAge: '30' } });
  });

  it('uses localStorage when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const { savePlanningData, loadPlanningData } = await import('../js/planning.js');
    await savePlanningData({ finance: { curAge: '25' } });
    expect(JSON.parse(localStorage.getItem('planningData'))).toEqual({ finance: { curAge: '25' } });
    const data = await loadPlanningData();
    expect(data).toEqual({ finance: { curAge: '25' } });
  });
});
