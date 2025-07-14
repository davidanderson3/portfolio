import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/dragAndDrop.js', () => ({
  enableTaskDragAndDrop: vi.fn()
}));

vi.mock('../js/helpers.js', () => ({
  saveDecisions: vi.fn(async () => {}),
  generateId: vi.fn(),
  makeIconBtn: () => document.createElement('button'),
  linkify: (t) => t
}));

vi.mock('../js/goals.js', () => ({
  createGoalRow: vi.fn((goal) => {
    const row = document.createElement('div');
    row.className = 'decision-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!goal.completed;
    row.appendChild(cb);
    const btnRow = document.createElement('div');
    btnRow.className = 'button-row';
    row.appendChild(btnRow);
    return row;
  })
}));

let renderChildren;
let helpers;
let container;

beforeEach(async () => {
  vi.resetModules();
  const dom = new JSDOM('<div id="container"></div>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.openGoalIds = new Set();
  helpers = await import('../js/helpers.js');
  ({ renderChildren } = await import('../js/tasks.js'));
  container = document.getElementById('container');
});

describe('task completion', () => {
  it('moves task to completed list immediately on check', async () => {
    const goal = { id: 'g1', type: 'goal', parentGoalId: null, completed: false };
    const task = { id: 't1', type: 'task', text: 't', notes: '', parentGoalId: 'g1', completed: false, dateCompleted: '' };
    const all = [goal, task];

    await renderChildren(goal, all, container);
    const cb = container.querySelector('input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new window.Event('change', { bubbles: true }));
    // Immediately after dispatch, task list should be empty and completed list should have the task
    const taskList = container.querySelector('.task-list');
    const doneList = container.querySelector('.completed-task-list');
    expect(taskList.children.length).toBe(0);
    expect(doneList.children.length).toBe(1);
    expect(doneList.querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(helpers.saveDecisions).toHaveBeenCalled();
  });
});
