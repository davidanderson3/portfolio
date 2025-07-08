import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMock = vi.fn();
const updateMock = vi.fn();
const getMock = vi.fn();

// Simple localStorage mock for Node environment
const storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();
global.localStorage = storage;

vi.mock('../js/auth.js', () => {
  return {
    getCurrentUser: () => ({ uid: 'user1' }),
    db: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: getMock,
          set: setMock,
          update: updateMock
        }))
      }))
    }
  };
});

beforeEach(() => {
  setMock.mockClear();
  updateMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  localStorage.clear();
});

describe('database helpers', () => {
  it('loads decisions from Firestore', async () => {
    getMock.mockResolvedValue({ data: () => ({ items: [{ id: '1', text: 't' }] }) });
    const { loadDecisions } = await import('../js/helpers.js');
    const result = await loadDecisions(true);
    expect(result).toEqual([{ id: '1', text: 't' }]);
    expect(getMock).toHaveBeenCalled();
  });

  it('converts Timestamp hiddenUntil values to strings', async () => {
    const future = new Date(Date.now() + 3600 * 1000);
    const tsObj = { toDate: () => future };
    getMock.mockResolvedValue({ data: () => ({ items: [{ id: 'g1', text: 't', hiddenUntil: tsObj }] }) });
    const { loadDecisions } = await import('../js/helpers.js');
    const result = await loadDecisions(true);
    expect(typeof result[0].hiddenUntil).toBe('string');
    const hideUntil = Date.parse(result[0].hiddenUntil) || 0;
    expect(hideUntil).toBeGreaterThan(Date.now());
  });

  it('saves decisions to Firestore', async () => {
    const items = [{ id: 'a', text: 'b' }];
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions(items);
    expect(setMock).toHaveBeenCalledWith({ items }, { merge: true });
  });

  it('saves goal order', async () => {
    const { saveGoalOrder } = await import('../js/helpers.js');
    await saveGoalOrder(['a', 'b']);
    expect(updateMock).toHaveBeenCalledWith({ goalOrder: ['a', 'b'] });
  });

  it('saves lists for anonymous users to localStorage', async () => {
    // Remock getCurrentUser to return null
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const { saveLists: saveAnon } = await import('../js/helpers.js');
    await saveAnon([{ name: 'test' }]);
    expect(JSON.parse(localStorage.getItem('myLists'))).toEqual([{ name: 'test' }]);
  });
});
