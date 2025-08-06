import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMock = vi.fn();

const storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; },
    key: index => Object.keys(store)[index],
    get length() { return Object.keys(store).length; }
  };
})();

global.localStorage = storage;

vi.mock('../js/auth.js', () => ({
  getCurrentUser: () => ({ uid: 'user1' }),
  db: {
    collection: () => ({
      doc: () => ({
        set: setMock
      })
    })
  }
}));

beforeEach(() => {
  setMock.mockClear();
  localStorage.clear();
  vi.resetModules();
  global.alert = vi.fn();
});

describe('restoreBackup', () => {
  it('restores selected backup to Firestore', async () => {
    const backupData = [{ id: '1', text: 'a' }];
    localStorage.setItem('backup-2024-01-01', JSON.stringify(backupData));
    const { restoreBackup } = await import('../js/helpers.js');
    const key = await restoreBackup(keys => keys[0]);
    expect(key).toBe('backup-2024-01-01');
    expect(setMock).toHaveBeenCalledWith({ items: backupData }, { merge: true });
    expect(JSON.parse(localStorage.getItem('cachedDecisions'))).toEqual(backupData);
    expect(localStorage.getItem('pendingDecisions')).toBeNull();
  });

  it('returns null when no backups found', async () => {
    const { restoreBackup } = await import('../js/helpers.js');
    const key = await restoreBackup(() => null);
    expect(key).toBeNull();
  });
});

