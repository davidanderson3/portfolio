import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/dragAndDrop.js', () => ({
  initializeGlobalDragHandlers: vi.fn(),
  enableGoalDragAndDrop: vi.fn()
}));

vi.mock('../js/tasks.js', () => ({
  attachTaskButtons: vi.fn(),
  renderChildren: vi.fn()
}));

vi.mock('../js/googleCalendar.js', () => ({ createCalendarEvent: vi.fn() }));

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(),
  saveDecisions: vi.fn(),
  saveGoalOrder: vi.fn(),
  loadGoalOrder: vi.fn(async () => []),
  generateId: vi.fn(() => 'g1'),
  pickDate: vi.fn(async () => ''),
  pickDateRange: vi.fn(async () => ({ start: null, end: null })),
  makeIconBtn: (symbol, title, fn) => {
    const b = document.createElement('button');
    b.title = title;
    b.onclick = fn;
    return b;
  },
  formatDaysUntil: () => '',
  linkify: (t) => t
}));

vi.mock('../js/auth.js', () => ({ db: {} }));

let renderGoalsAndSubitems;
let createGoalRow;
let helpers;

beforeEach(async () => {
  vi.resetModules();
  const dom = new JSDOM('<div id="goalList"></div><div id="completedList"></div><div id="calendarContent"></div>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.firebase = { auth: () => ({ currentUser: null }) };
  helpers = await import('../js/helpers.js');
  const mod = await import('../js/goals.js');
  renderGoalsAndSubitems = mod.renderGoalsAndSubitems;
  createGoalRow = mod.createGoalRow;
});

describe('completed goals ordering', () => {
  it('orders completed goals by most recent first', async () => {
    helpers.loadDecisions.mockResolvedValue([
      { id: 'g1', type: 'goal', completed: true, dateCompleted: '2023-01-01', parentGoalId: null },
      { id: 'g2', type: 'goal', completed: true, dateCompleted: '2023-02-01', parentGoalId: null },
      { id: 'g3', type: 'goal', completed: false, dateCompleted: '', parentGoalId: null }
    ]);

    await renderGoalsAndSubitems();

    const ids = [...document.getElementById('completedList').children].map(el => el.dataset.goalId);
    expect(ids).toEqual(['g2', 'g1']);
  });
});

describe('goal postponing', () => {
  it('sets hiddenUntil based on selected postpone option', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));

    const goal = {
      id: 'g1',
      type: 'goal',
      text: 'Test',
      notes: '',
      completed: false,
      dateCompleted: '',
      parentGoalId: null,
      hiddenUntil: null
    };

    helpers.loadDecisions.mockResolvedValue([goal]);

    const wrapper = document.createElement('div');
    wrapper.className = 'decision goal-card';
    wrapper.dataset.goalId = goal.id;
    const row = createGoalRow(goal);
    wrapper.appendChild(row);
    document.getElementById('goalList').appendChild(wrapper);

    const option = [...document.querySelectorAll('.postpone-option')]
      .find(btn => btn.textContent === '2 days');
    option.click();
    await Promise.resolve();

    expect(helpers.saveDecisions).toHaveBeenCalled();
    const calls = helpers.saveDecisions.mock.calls;
    const saved = calls[calls.length - 1][0][0];
    expect(saved.hiddenUntil).toBe(new Date('2023-01-03T00:00:00.000Z').toISOString());

    vi.useRealTimers();
  });
});

describe('addCalendarGoal', () => {
  it('renders goal in calendar section and main list', async () => {
    helpers.loadDecisions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'g1',
          type: 'goal',
          text: 'My calendar goal',
          notes: '',
          completed: false,
          resolution: '',
          dateCompleted: '',
          parentGoalId: null,
          hiddenUntil: null,
          scheduled: '2024-01-02',
          scheduledEnd: ''
        }
      ]);
    const mod = await import('../js/goals.js');
    const { addCalendarGoal } = mod;

    global.prompt = vi.fn()
      .mockReturnValueOnce('My calendar goal')
      .mockReturnValueOnce('');

    helpers.pickDateRange.mockResolvedValue({ start: '2024-01-02', end: '' });
    await addCalendarGoal('2024-01-02');

    const content = document.getElementById('calendarContent');
    expect(content.children.length).toBeGreaterThan(0);
    // goal should also appear in the main goal list
    expect(document.getElementById('goalList').children.length).toBe(1);
  });

  it('uses provided date when none selected', async () => {
    helpers.saveDecisions.mockClear();
    helpers.loadDecisions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    global.prompt = vi.fn()
      .mockReturnValueOnce('My calendar goal')
      .mockReturnValueOnce('');
    helpers.pickDateRange.mockResolvedValue({ start: '', end: '' });
    const mod = await import('../js/goals.js');
    const { addCalendarGoal } = mod;
    await addCalendarGoal('2024-01-02');
    expect(helpers.saveDecisions).toHaveBeenCalled();
    const saved = helpers.saveDecisions.mock.calls[0][0].pop();
    expect(saved.scheduled).toBe('2024-01-02');
  });

  it('saves goal order when user signed in', async () => {
    helpers.loadDecisions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    global.prompt = vi.fn()
      .mockReturnValueOnce('Cal goal')
      .mockReturnValueOnce('');
    helpers.pickDateRange.mockResolvedValue({ start: '2024-01-02', end: '' });

    global.firebase = { auth: () => ({ currentUser: { uid: 'u1' } }) };
    helpers.loadGoalOrder.mockResolvedValue(['a']);

    const mod = await import('../js/goals.js');
    const { addCalendarGoal } = mod;
    await addCalendarGoal('2024-01-02');

    const calls = helpers.saveGoalOrder.mock.calls.map(c => c[0]);
    expect(calls).toContainEqual(['a', 'g1']);
  });
});

describe('editing scheduled date', () => {
  it('re-renders goals when schedule changes', async () => {
    const goal = {
      id: 'g1',
      type: 'goal',
      text: 'Test',
      notes: '',
      completed: false,
      dateCompleted: '',
      parentGoalId: null,
      scheduled: '2024-01-01',
      scheduledEnd: ''
    };

    helpers.loadDecisions.mockResolvedValue([goal]);

    const mod = await import('../js/goals.js');
    const { createGoalRow } = mod;

    const wrapper = document.createElement('div');
    wrapper.className = 'decision goal-card';
    wrapper.dataset.goalId = goal.id;
    const row = createGoalRow(goal);
    wrapper.appendChild(row);
    document.getElementById('goalList').appendChild(wrapper);

    const editBtn = row.querySelector('button[title="Edit"]');
    editBtn.click();
    await Promise.resolve();

    row.querySelector('.middle-group input').value = 'Test';
    const inputs = row.querySelectorAll('.due-column input');
    inputs[1].value = '2024-02-01';

    editBtn.click();
    await Promise.resolve();
    await Promise.resolve();

  expect(document.getElementById('goalList').contains(wrapper)).toBe(true);
  });
});

describe('deadline button', () => {
  it('updates deadline when set', async () => {
    const goal = { id: 'g1', type: 'goal', text: 'Test', notes: '', completed: false, dateCompleted: '', parentGoalId: null, deadline: '', scheduled: '', scheduledEnd: '' };
    helpers.loadDecisions.mockResolvedValue([goal]);

    const mod = await import('../js/goals.js');
    const { createGoalRow } = mod;

    const wrapper = document.createElement('div');
    wrapper.className = 'decision goal-card';
    wrapper.dataset.goalId = goal.id;
    const row = createGoalRow(goal);
    wrapper.appendChild(row);
    document.getElementById('goalList').appendChild(wrapper);

    helpers.pickDate.mockResolvedValue('2024-02-10');
    await row.querySelector('button[title="Set deadline"]').onclick();

    expect(helpers.saveDecisions).toHaveBeenCalled();
    expect(goal.deadline).toBe('2024-02-10');
  });
});

describe('parent goal styling', () => {
  it('uses the same row layout whether collapsed or expanded', async () => {
    const parent = { id: 'p1', type: 'goal', text: 'P', notes: '', completed: false, parentGoalId: null };
    const child = { id: 'c1', type: 'goal', text: 'C', notes: '', completed: false, parentGoalId: 'p1' };
    helpers.loadDecisions.mockResolvedValue([parent, child]);

    await renderGoalsAndSubitems();
    let row = document.querySelector('#goalList .decision-row');
    expect(row.classList.contains('parent-summary')).toBe(false);

    window.openGoalIds.add('p1');
    await renderGoalsAndSubitems();
    row = document.querySelector('#goalList .decision-row');
    expect(row.classList.contains('parent-summary')).toBe(false);
  });
});

