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
  makeIconBtn: () => document.createElement('button'),
  formatDaysUntil: () => '',
  linkify: (t) => t
}));

vi.mock('../js/auth.js', () => ({ db: {} }));

let renderGoalsAndSubitems;
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
