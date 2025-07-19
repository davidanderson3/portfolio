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
  generateId: vi.fn(),
  pickDate: vi.fn(async () => ''),
  pickDateRange: vi.fn(async () => ({ start: '', end: '' })),
  makeIconBtn: () => document.createElement('button'),
  formatDaysUntil: () => '',
  linkify: (t) => t
}));
vi.mock('../js/auth.js', () => ({ db: {} }));

let renderTodaySchedule;

beforeEach(async () => {
  vi.resetModules();
  const today = new JSDOM('<div id="goalList"></div><div id="completedList"></div><div id="test"></div>');
  global.window = today.window;
  global.document = today.window.document;
  const mod = await import('../js/goals.js');
  renderTodaySchedule = mod.renderTodaySchedule;
});

describe('renderTodaySchedule', () => {
  it('places goals under the correct hour', () => {
    const container = document.getElementById('test');
    const today = new Date().toISOString().split('T')[0];
    const items = [
      { id: 'g1', type: 'goal', text: 'Morning', scheduled: `${today}T08:00` },
      { id: 'g2', type: 'goal', text: 'Afternoon', scheduled: `${today}T13:30` }
    ];
    renderTodaySchedule(items, container);
    const rows = container.querySelectorAll('.hour-row');
    expect(rows.length).toBe(24);
    expect(rows[8].textContent).toContain('Morning');
    expect(rows[13].textContent).toContain('Afternoon');
  });
});
