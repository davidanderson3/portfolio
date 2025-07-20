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
  it('renders a week of hourly rows and places goals correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T10:00:00Z'));

    const container = document.getElementById('test');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const items = [
      { id: 'g1', type: 'goal', text: 'Lunch', scheduled: `${todayStr}T12:00` },
      { id: 'g2', type: 'goal', text: 'Evening', scheduled: `${tomorrowStr}T19:30` }
    ];

    const weather = {
      hourly: {
        time: [`${todayStr}T12:00`, `${tomorrowStr}T19:00`],
        temperature_2m: [60, 70],
        precipitation_probability: [0, 0]
      }
    };

    renderTodaySchedule(items, container, weather);
    const days = container.querySelectorAll('.day-section');
    expect(days.length).toBe(7);
    const firstDayRows = days[0].querySelectorAll('.hour-row');
    const startHour = Math.max(6, new Date().getHours() + 1);
    expect(firstDayRows.length).toBe(22 - startHour);
    expect(firstDayRows[1].textContent).toContain('Lunch');
    const secondDayRows = days[1].querySelectorAll('.hour-row');
    expect(secondDayRows[13].textContent).toContain('Evening');
    expect(firstDayRows[1].classList.contains('comfortable-temp')).toBe(true);
    vi.useRealTimers();
  });
});
