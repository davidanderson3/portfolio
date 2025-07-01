import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(),
  loadLists: vi.fn()
}));
import { renderGoalsReport } from '../js/tabReports.js';

describe('renderGoalsReport', () => {
  it('counts only active uncompleted tasks', () => {
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

    expect(container.innerHTML).toContain('Active goals: 1');
    expect(container.innerHTML).toContain('Active tasks: 1');
  });
});
