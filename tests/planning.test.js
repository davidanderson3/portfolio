import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateFinanceProjection, calculateHappinessScore } from '../js/planning.js';

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

  it('calculates happiness score', () => {
    const score = calculateHappinessScore({ hobbyHours: 10, workHours: 40 });
    expect(score).toBe(-20);
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
    getMock.mockResolvedValue({ exists: true, data: () => ({ finance: { curAge: 20 } }) });
    const { loadPlanningData } = await import('../js/planning.js');
    const res = await loadPlanningData();
    expect(res).toEqual({ finance: { curAge: 20 } });
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { savePlanningData } = await import('../js/planning.js');
    await savePlanningData({ happiness: { workHours: 5 } });
    expect(setMock).toHaveBeenCalledWith({ happiness: { workHours: 5 } }, { merge: true });
  });

  it('uses localStorage when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const { savePlanningData, loadPlanningData } = await import('../js/planning.js');
    await savePlanningData({ foo: 'bar' });
    expect(JSON.parse(localStorage.getItem('planningData'))).toEqual({ foo: 'bar' });
    const data = await loadPlanningData();
    expect(data).toEqual({ foo: 'bar' });
  });
});
