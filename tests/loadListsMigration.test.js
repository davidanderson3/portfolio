import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SAMPLE_LISTS } from '../js/sampleData.js';

defineGlobalMocks();

let currentUser;
let collectionMock;
let docMock;
let getMock;
let setMock;

function defineGlobalMocks() {
  vi.mock('../js/auth.js', () => ({
    getCurrentUser: () => currentUser,
    db: { collection: (...args) => collectionMock(...args) },
  }));
}

function createStorage() {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; },
  };
}

beforeEach(() => {
  vi.resetModules();
  currentUser = { uid: 'u1' };
  getMock = vi.fn();
  setMock = vi.fn();
  docMock = vi.fn(() => ({ get: getMock, set: setMock }));
  collectionMock = vi.fn(() => ({ doc: docMock }));
  global.localStorage = createStorage();
  global.confirm = vi.fn();
});

const sampleLegacy = SAMPLE_LISTS;


describe('loadLists migration', () => {
  it('imports legacy lists when approved', async () => {
    localStorage.setItem('myLists', JSON.stringify([{ name: 'Local', columns: [], items: [], hiddenUntil: null }]));
    getMock.mockResolvedValueOnce({ exists: false });
    confirm.mockReturnValueOnce(true);

    const { loadLists } = await import('../js/helpers.js');
    const lists = await loadLists();
    expect(confirm).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalled();
    expect(localStorage.getItem('myLists')).toBeNull();
    expect(lists[0].name).toBe('Local');
  });

  it('discards legacy lists when declined', async () => {
    localStorage.setItem('myLists', JSON.stringify([{ name: 'Local', columns: [], items: [], hiddenUntil: null }]));
    getMock.mockResolvedValueOnce({ exists: false });
    confirm.mockReturnValueOnce(false);

    const { loadLists } = await import('../js/helpers.js');
    const lists = await loadLists();
    expect(confirm).toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('myLists')).toBeNull();
    expect(lists).toEqual([]);
  });

  it('ignores sample legacy lists', async () => {
    localStorage.setItem('myLists', JSON.stringify(sampleLegacy));
    getMock.mockResolvedValueOnce({ exists: false });

    const { loadLists } = await import('../js/helpers.js');
    const lists = await loadLists();
    expect(confirm).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('myLists')).toBeNull();
    expect(lists).toEqual([]);
  });
});
