import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteMock = vi.fn();
const setMock = vi.fn();
let currentUser = null;

vi.mock('../js/auth.js', () => ({
  getCurrentUser: () => currentUser,
  auth: { onAuthStateChanged: vi.fn() },
  db: {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({ delete: deleteMock, set: setMock })
        })
      })
    })
  }
}));

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

beforeEach(() => {
  deleteMock.mockClear();
  setMock.mockClear();
  currentUser = null;
  vi.resetModules();
  localStorage.clear();
});

describe('clearHiddenTabs', () => {
  it('clears localStorage for anonymous users', async () => {
    const { clearHiddenTabs } = await import('../js/settings.js');
    localStorage.setItem('hiddenTabs', JSON.stringify({ a: 'b' }));
    await clearHiddenTabs();
    expect(localStorage.getItem('hiddenTabs')).toBeNull();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('deletes Firestore doc for signed-in users', async () => {
    currentUser = { uid: 'u1' };
    const { clearHiddenTabs } = await import('../js/settings.js');
    await clearHiddenTabs();
    expect(deleteMock).toHaveBeenCalled();
  });
});

describe('saveHiddenTabs', () => {
  it('overwrites hidden tabs for signed-in users', async () => {
    currentUser = { uid: 'u1' };
    const { saveHiddenTabs } = await import('../js/settings.js');
    await saveHiddenTabs({});
    expect(setMock.mock.calls[0]).toEqual([{ tabs: {} }]);
  });
});
