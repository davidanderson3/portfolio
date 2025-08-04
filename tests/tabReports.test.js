import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { JSDOM } from 'jsdom';
vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(),
  loadLists: vi.fn()
}));
import { renderGoalsReport, initTabReports } from '../js/tabReports.js';

describe('renderGoalsReport', () => {
  it('clears the container when rendering', () => {
    const container = { innerHTML: '', textContent: '' };
    global.document = {
      getElementById: (id) => (id === 'goalsReport' ? container : null)
    };
    const items = [
      { id: 'g1', type: 'goal', completed: false },
      { id: 't1', type: 'task', parentGoalId: 'g1', completed: false },
      { id: 't2', type: 'task', parentGoalId: 'g1', completed: true },
      { id: 'g2', type: 'goal', completed: true },
      { id: 't3', type: 'task', parentGoalId: 'g2', completed: false },
      { id: 't4', type: 'task', parentGoalId: 'g2', completed: true },
      { id: 't5', type: 'task', completed: false }
    ];

    renderGoalsReport(items);

    expect(container.innerHTML).toBe('');
  });

  it('ignores missing container', () => {
    global.document = { getElementById: () => null };
    const items = [];

    renderGoalsReport(items);
    // nothing to assert, just ensure no error
  });

  it('works with hidden tasks', () => {
    const container = { innerHTML: '', textContent: '' };
    global.document = {
      getElementById: (id) => (id === 'goalsReport' ? container : null)
    };
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    const items = [
      { id: 'g1', type: 'goal', completed: false, hiddenUntil: future },
      { id: 't1', type: 'task', parentGoalId: 'g1', completed: false }
    ];

    renderGoalsReport(items);
    expect(container.innerHTML).toBe('');
  });
});

describe('renderDailyReport', () => {
  it('shows completions from localStorage when not logged in', async () => {
    const today = new Date().toISOString().split('T')[0];
    const dom = new JSDOM('<div id="dailyReport"></div><div id="goalsReport"></div><div id="listsReport"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    const storage = (() => {
      let store = {};
      return {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
        clear: () => { store = {}; }
      };
    })();
    global.localStorage = storage;
    localStorage.setItem('taskCompletions', JSON.stringify({ [today]: ['t1'] }));

    const helpers = await import('../js/helpers.js');
    helpers.loadDecisions.mockResolvedValue([{ id: 't1', type: 'task', recurs: 'daily' }]);
    helpers.loadLists.mockResolvedValue([]);

    await initTabReports(null, null);

    const dot = document.querySelector(`.completion-dot[data-date="${today}"][data-cat="daily"]`);
    expect(dot.classList.contains('completed')).toBe(true);
  });
});
