import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(),
  saveDecisions: vi.fn(),
  generateId: vi.fn(),
  makeIconBtn: (sym, title, fn) => {
    const b = document.createElement('button');
    b.textContent = sym;
    b.onclick = fn;
    return b;
  },
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

describe('missed task shading', () => {
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

    const yesterday = new Date(now.getTime() - 86400000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
    localStorage.setItem('taskCompletions', JSON.stringify({
      [yesterday.toLocaleDateString('en-CA')]: ['t1'],
      [twoDaysAgo.toLocaleDateString('en-CA')]: ['t2'],
      [threeDaysAgo.toLocaleDateString('en-CA')]: ['t3']
    }));

    const helpers = await import('../js/helpers.js');
    helpers.loadDecisions.mockResolvedValue([
      { id: 't1', type: 'task', text: 'A', recurs: 'daily' },
      { id: 't2', type: 'task', text: 'B', recurs: 'daily' },
      { id: 't3', type: 'task', text: 'C', recurs: 'daily' }
    ]);

    ({ renderDailyTasks } = await import('../js/daily.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('darkens tasks based on days missed', async () => {
    await renderDailyTasks(null, {});
    const t1 = document.querySelector('[data-task-id="t1"] .daily-task').style.background;
    const t2 = document.querySelector('[data-task-id="t2"] .daily-task').style.background;
    const t3 = document.querySelector('[data-task-id="t3"] .daily-task').style.background;
    expect(t1).toBe('rgb(255, 250, 240)');
    expect(t2).toBe('rgba(255, 165, 0, 0.2)');
    expect(t3).toBe('rgba(255, 165, 0, 0.3)');
  });
});

describe('quickAddTask', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('saves task and reloads list', async () => {
    const dom = new JSDOM(`
      <button class="tab-button active" data-target="dailyPanel"></button>
      <div id="dailyPanel"></div>
    `, { url: 'https://example.com' });
    global.window = dom.window;
    global.document = dom.window.document;

    const helpers = await import('../js/helpers.js');
    helpers.loadDecisions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'x1', type: 'task', text: 'Test', recurs: 'daily' }]);
    helpers.saveDecisions.mockResolvedValue();
    helpers.generateId.mockReturnValue('x1');

    const daily = await import('../js/daily.js');
    await daily.quickAddTask('daily', 'Test');
    expect(helpers.saveDecisions).toHaveBeenCalled();
    expect(document.querySelector('#dailyTasksList input[type="checkbox"]')).toBeTruthy();
  });
});

describe('time of day sections', () => {
  it('renders tasks into respective containers', async () => {
    vi.resetModules();
    const dom = new JSDOM('<div id="dailyPanel"></div>', { url: 'https://example.com' });
    global.window = dom.window;
    global.document = dom.window.document;

    const helpers = await import('../js/helpers.js');
    helpers.loadDecisions.mockResolvedValue([
      { id: 'f', type: 'task', text: 'F', recurs: 'daily', timeOfDay: 'firstThing' },
      { id: 'm', type: 'task', text: 'M', recurs: 'daily', timeOfDay: 'morning' },
      { id: 'a', type: 'task', text: 'A', recurs: 'daily', timeOfDay: 'afternoon' },
      { id: 'e', type: 'task', text: 'E', recurs: 'daily', timeOfDay: 'evening' },
      { id: 'b', type: 'task', text: 'B', recurs: 'daily', timeOfDay: 'endOfDay' }
    ]);

    const { renderDailyTasks } = await import('../js/daily.js');
    await renderDailyTasks(null, {});
    expect(document.querySelector('#firstThingTasksList [data-task-id="f"]')).toBeTruthy();
    expect(document.querySelector('#morningTasksList [data-task-id="m"]')).toBeTruthy();
    expect(document.querySelector('#afternoonTasksList [data-task-id="a"]')).toBeTruthy();
    expect(document.querySelector('#eveningTasksList [data-task-id="e"]')).toBeTruthy();
    expect(document.querySelector('#endOfDayTasksList [data-task-id="b"]')).toBeTruthy();
  });
});

  describe('editing daily tasks', () => {
    it('allows inline editing with time of day', async () => {
      vi.resetModules();
      const dom = new JSDOM('<div id="dailyPanel"></div>', { url: 'https://example.com' });
      global.window = dom.window;
      global.document = dom.window.document;

      const helpers = await import('../js/helpers.js');
      helpers.loadDecisions
        .mockResolvedValueOnce([{ id: 't1', type: 'task', text: 'Old', recurs: 'daily', timeOfDay: 'morning', notes: '' }])
        .mockResolvedValueOnce([{ id: 't1', type: 'task', text: 'Old', recurs: 'daily', timeOfDay: 'morning', notes: '' }]);
      helpers.saveDecisions.mockResolvedValue();

      const { renderDailyTasks } = await import('../js/daily.js');
      await renderDailyTasks(null, {});

      const editBtn = Array.from(document.querySelectorAll('.daily-task button')).find(b => b.textContent === '✏️');
      editBtn.click();
      const label = document.querySelector('.daily-task > div:nth-child(2)');
      label.querySelector('input').value = 'New';
      label.querySelector('textarea').value = 'N';
      label.querySelector('select').value = 'evening';
      editBtn.click();
      await new Promise(r => setTimeout(r, 0));

      expect(helpers.saveDecisions).toHaveBeenCalledWith([
        { id: 't1', type: 'task', text: 'New', recurs: 'daily', timeOfDay: 'evening', notes: 'N' }
      ]);
      expect(document.querySelector('#eveningTasksList [data-task-id="t1"]')).toBeTruthy();
    });

    it('moves task to selected section on save', async () => {
      vi.resetModules();
      const dom = new JSDOM('<div id="dailyPanel"></div>', { url: 'https://example.com' });
      global.window = dom.window;
      global.document = dom.window.document;

      const helpers = await import('../js/helpers.js');
      helpers.loadDecisions
        .mockResolvedValueOnce([{ id: 't1', type: 'task', text: 'Old', recurs: 'daily', timeOfDay: 'morning', notes: '' }])
        .mockResolvedValueOnce([{ id: 't1', type: 'task', text: 'Old', recurs: 'daily', timeOfDay: 'morning', notes: '' }]);
      helpers.saveDecisions.mockResolvedValue();

      const { renderDailyTasks } = await import('../js/daily.js');
      await renderDailyTasks(null, {});

      const editBtn = Array.from(document.querySelectorAll('.daily-task button')).find(b => b.textContent === '✏️');
      editBtn.click();
      const label = document.querySelector('.daily-task > div:nth-child(2)');
      label.querySelector('input').value = 'New';
      label.querySelector('textarea').value = 'N';
      label.querySelector('select').value = 'endOfDay';
      editBtn.click();
      await new Promise(r => setTimeout(r, 0));

      expect(helpers.saveDecisions).toHaveBeenCalledWith([
        { id: 't1', type: 'task', text: 'New', recurs: 'daily', timeOfDay: 'endOfDay', notes: 'N' }
      ]);
      expect(document.querySelector('#endOfDayTasksList [data-task-id="t1"]')).toBeTruthy();
    });
  });
