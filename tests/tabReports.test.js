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

  it('ignores child goals when reporting status', () => {
    const container = { innerHTML: '', textContent: '' };
    global.document = {
      getElementById: (id) => (id === 'goalsReport' ? container : null)
    };
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    const items = [
      { id: 'g1', type: 'goal', completed: false },
      { id: 'cg1', type: 'goal', parentGoalId: 'g1', completed: false },
      { id: 'cg2', type: 'goal', parentGoalId: 'g1', completed: false, hiddenUntil: future }
    ];

    renderGoalsReport(items);

    expect(container.innerHTML).toContain('Active goals: 1');
    expect(container.innerHTML).toContain('Hidden goals: 0');
  });

  it('counts tasks under hidden goals as hidden', () => {
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

    expect(container.innerHTML).toContain('Active tasks: 0');
    expect(container.innerHTML).toContain('Hidden tasks: 1');
  });
});
