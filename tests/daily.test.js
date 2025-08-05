import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(),
  saveDecisions: vi.fn(),
  generateId: vi.fn(),
  makeIconBtn: () => document.createElement('button'),
  linkify: t => t,
  pickDate: vi.fn()
}));

vi.mock('../js/auth.js', () => ({ db: {}, currentUser: null }));
vi.mock('../js/tabReports.js', () => ({ updateCompletionDots: vi.fn() }));
vi.mock('../js/googleCalendar.js', () => ({ createCalendarEvent: vi.fn() }));

describe('daily task ordering', () => {
  let renderDailyTasks;
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const now = new Date('2024-01-10T12:00:00Z');
    vi.setSystemTime(now);

    const dom = new JSDOM('<div id="dailyPanel"></div>', { url: 'https://example.com' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    const yesterdayKey = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA');
    localStorage.setItem('taskCompletions', JSON.stringify({ [yesterdayKey]: ['a'] }));

    const helpers = await import('../js/helpers.js');
    helpers.loadDecisions.mockResolvedValue([
      { id: 'a', type: 'task', text: 'A', recurs: 'daily' },
      { id: 'b', type: 'task', text: 'B', recurs: 'daily' },
      { id: 'c', type: 'task', text: 'C', recurs: 'daily' }
    ]);

    ({ renderDailyTasks } = await import('../js/daily.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves unfinished tasks from previous day to top', async () => {
    await renderDailyTasks(null, {});
    const ids = Array.from(document.querySelectorAll('#dailyTasksList .daily-task-wrapper'))
      .map(el => el.dataset.taskId);
    expect(ids).toEqual(['b', 'c', 'a']);
  });
});
