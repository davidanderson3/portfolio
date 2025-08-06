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
    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    await saveDecisions(items);
    expect(JSON.parse(localStorage.getItem('pendingDecisions'))).toEqual({
      uid: 'user1',
      items
    });
    expect(setMock).not.toHaveBeenCalled();
    await flushPendingDecisions();
    expect(setMock).toHaveBeenCalledWith({ items }, { merge: true });
  });

  it('saves goal order', async () => {
    const { saveGoalOrder } = await import('../js/helpers.js');
    await saveGoalOrder(['a', 'b']);
    expect(setMock).toHaveBeenCalledWith({ goalOrder: ['a', 'b'] }, { merge: true });
  });

  it('ignores empty decisions array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([]);
    expect(setMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores invalid decision objects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ foo: 'bar' }]);
    expect(setMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores empty goal order', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveGoalOrder } = await import('../js/helpers.js');
    await saveGoalOrder([]);
    expect(setMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('alerts when saveDecisions fails', async () => {
    setMock.mockRejectedValueOnce(new Error('fail'));
    const alertSpy = vi.fn();
    global.alert = alertSpy;
    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ id: 'a', text: 'b' }]);
    await flushPendingDecisions();
    expect(alertSpy).toHaveBeenCalled();
  });

  it('alerts when saveGoalOrder fails', async () => {
    setMock.mockRejectedValueOnce(new Error('fail'));
    const alertSpy = vi.fn();
    global.alert = alertSpy;
    const { saveGoalOrder } = await import('../js/helpers.js');
    await saveGoalOrder(['a']);
    expect(alertSpy).toHaveBeenCalled();
  });

  it('alerts when not signed in', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const alertSpy = vi.fn();
    global.alert = alertSpy;
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ id: 'x', text: 'y' }]);
    expect(alertSpy).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('pendingDecisions'))).toEqual({
      uid: null,
      items: [{ id: 'x', text: 'y' }]
    });
  });

  it('saves lists for anonymous users to localStorage', async () => {
    // Remock getCurrentUser to return null
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {} }));
    const { saveLists: saveAnon } = await import('../js/helpers.js');
    await saveAnon([{ name: 'test' }]);
    expect(JSON.parse(localStorage.getItem('myLists'))).toEqual([{ name: 'test' }]);
  });

  it('returns sample decisions for anonymous users', async () => {
    const dbMock = { collection: vi.fn() };
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: dbMock }));
    const { loadDecisions } = await import('../js/helpers.js');
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');
    const result = await loadDecisions(true);
    expect(result.length).toBe(SAMPLE_DECISIONS.length);
    result.filter(i => i.scheduled).forEach(i => {
      expect(new Date(i.scheduled).getTime()).toBeGreaterThan(Date.now());
    });
    expect(dbMock.collection).not.toHaveBeenCalled();
  });

  it('does not sync sample decisions from local cache on login', async () => {
    vi.doMock('../js/auth.js', () => ({
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
    }));
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');
    localStorage.setItem(
      'pendingDecisions',
      JSON.stringify({ uid: null, items: SAMPLE_DECISIONS })
    );
    getMock.mockResolvedValue({ data: () => ({ items: [{ id: '1', text: 'server' }] }) });
    const { loadDecisions } = await import('../js/helpers.js');
    const result = await loadDecisions(true);
    expect(setMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: '1', text: 'server' }]);
    expect(localStorage.getItem('pendingDecisions')).toBeNull();
  });

  it('debounces rapid saveDecisions calls', async () => {
    vi.doMock('../js/auth.js', () => ({
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
    }));
    const itemsA = [{ id: 'a', text: 'A' }];
    const itemsB = [{ id: 'b', text: 'B' }];

    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    await saveDecisions(itemsA);
    await saveDecisions(itemsB);

    expect(setMock).not.toHaveBeenCalled();

    await flushPendingDecisions();

    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith({ items: itemsB }, { merge: true });
  });

  it('merges or discards pending decisions when differing from server', async () => {
    vi.doMock('../js/auth.js', () => ({
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
    }));

    const { loadDecisions } = await import('../js/helpers.js');

    const server = [{ id: '1', text: 'server' }];
    getMock.mockResolvedValue({ data: () => ({ items: server }) });
    localStorage.setItem('pendingDecisions', JSON.stringify({ uid: 'user1', items: [{ id: '1', text: 'local' }, { id: '2', text: 'two' }] }));
    const setSpy = vi.spyOn(localStorage, 'setItem');

    global.window = { confirm: vi.fn(() => true) };
    const merged = await loadDecisions();
    expect(window.confirm).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith({ items: [{ id: '1', text: 'local' }, { id: '2', text: 'two' }] }, { merge: true });
    const backupCall = setSpy.mock.calls.find(c => /^backup-/.test(c[0]));
    expect(JSON.parse(backupCall[1])).toEqual(server);
    expect(merged).toEqual([{ id: '1', text: 'local' }, { id: '2', text: 'two' }]);

    // now test discard path
    setMock.mockClear();
    getMock.mockResolvedValue({ data: () => ({ items: server }) });
    localStorage.setItem('pendingDecisions', JSON.stringify({ uid: 'user1', items: [{ id: '1', text: 'local' }] }));
    setSpy.mockClear();
    global.window = { confirm: vi.fn(() => false) };
    const discarded = await loadDecisions();
    expect(window.confirm).toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
    expect(discarded).toEqual(server);
    const backupNone = setSpy.mock.calls.find(c => /^backup-/.test(c[0]));
    expect(backupNone).toBeUndefined();
  });
});
