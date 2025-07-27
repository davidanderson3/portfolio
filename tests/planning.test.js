
import { calculateFinanceProjection, calculateBudgetAllocation } from '../js/planning.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('planning calculations', () => {
  it('projects finances over years', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 32,
      savings: 1000,
      annualSavings: 100,
      returnRate: 0
    });
    expect(res).toEqual([
      { age: 30, balance: 1000 },
      { age: 31, balance: 1100 },
      { age: 32, balance: 1200 }
    ]);
  });

  it('calculates budget allocation', () => {
    const res = calculateBudgetAllocation({ income: 1000, taxRate: 10, mortgage: 300 });
    expect(res).toEqual({ taxes: 100, mortgage: 300, leftover: 600 });
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

beforeEach(() => {
  setMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  vi.doMock('../js/auth.js', createAuthMock);
  localStorage.clear();
});

describe('planning persistence', () => {
  it('loads data from Firestore', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ finance: { curAge: '30' } }) });
    const { loadPlanningData } = await import('../js/planning.js');
    const res = await loadPlanningData();
    expect(res.finance.curAge).toBe('30');
    expect(typeof res.lastUpdated).toBe('number');
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { savePlanningData } = await import('../js/planning.js');
    await savePlanningData({ finance: { curAge: '30' } });
    const saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.finance.curAge).toBe('30');
    expect(typeof saved.lastUpdated).toBe('number');
    expect(setMock).toHaveBeenCalledWith(saved, { merge: true });
  });

  it('uses localStorage when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const { savePlanningData, loadPlanningData } = await import('../js/planning.js');
    await savePlanningData({ finance: { curAge: '25' } });
    const stored = JSON.parse(localStorage.getItem('planningData'));
    expect(stored.finance.curAge).toBe('25');
    expect(typeof stored.lastUpdated).toBe('number');
    const data = await loadPlanningData();
    expect(data.finance.curAge).toBe('25');
  });

  it('prefers newer data source when merging', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ finance: { curAge: '30', retAge: '60' }, lastUpdated: 200 }) });
    localStorage.setItem('planningData', JSON.stringify({ finance: { curAge: '35' }, assets: { realEstate: 100 }, lastUpdated: 100 }));
    const { loadPlanningData } = await import('../js/planning.js');
    const res = await loadPlanningData();
    expect(res.finance.curAge).toBe('30');
    expect(res.assets.realEstate).toBe(100);
    expect(res.lastUpdated).toBe(200);
  });
});
