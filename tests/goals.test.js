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
  generateId: vi.fn(() => 'g1'),
  pickDate: vi.fn(async () => ''),
  pickDateRange: vi.fn(async () => ({ start: '', end: '' })),
  makeIconBtn: () => document.createElement('button'),
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
    const saved = helpers.saveDecisions.mock.calls[0][0][0];
    expect(saved.hiddenUntil).toBe(new Date('2023-01-03T00:00:00.000Z').toISOString());

    vi.useRealTimers();
  });
});

describe('addCalendarGoal', () => {
  it('renders goal in calendar section and main list', async () => {
    helpers.loadDecisions.mockResolvedValue([]);
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
    inputs[0].value = '2024-02-01';

    editBtn.click();
    await Promise.resolve();
    await Promise.resolve();

  expect(document.getElementById('goalList').contains(wrapper)).toBe(false);
  });
});

describe('parent-summary display', () => {
  it('applies compact class when collapsed and removes it when expanded', async () => {
    const parent = { id: 'p1', type: 'goal', text: 'P', notes: '', completed: false, parentGoalId: null };
    const child = { id: 'c1', type: 'goal', text: 'C', notes: '', completed: false, parentGoalId: 'p1' };
    helpers.loadDecisions.mockResolvedValue([parent, child]);

    await renderGoalsAndSubitems();
    let row = document.querySelector('#goalList .decision-row');
    expect(row.classList.contains('parent-summary')).toBe(true);

    window.openGoalIds.add('p1');
    await renderGoalsAndSubitems();
    row = document.querySelector('#goalList .decision-row');
    expect(row.classList.contains('parent-summary')).toBe(false);
  });
});
