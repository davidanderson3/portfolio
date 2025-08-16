import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadLists: vi.fn(),
  saveLists: vi.fn(),
  loadDecisions: vi.fn(),
  saveDecisions: vi.fn(),
  generateId: vi.fn(),
  pickDate: vi.fn()
}));

vi.mock('../js/goals.js', () => ({
  appendGoalToDOM: vi.fn()
}));

vi.mock('../js/auth.js', () => ({
  auth: { onAuthStateChanged: (cb) => cb() },
  db: {}
}));

let helpers;
let goals;

beforeEach(async () => {
  vi.resetModules();
  const dom = new JSDOM('<div id="listsPanel"></div><div id="listsFormModal"><div id="listsFormWrapper"></div></div><button class="tab-button active" data-target="listsPanel"></button><div id="goalList"></div>');
  global.window = dom.window;
  global.document = dom.window.document;
  helpers = await import('../js/helpers.js');
  goals = await import('../js/goals.js');
  helpers.loadLists.mockResolvedValue([{ name: 'Test', columns: [], items: [], hiddenUntil: null }]);
  helpers.loadDecisions.mockResolvedValue([]);
  helpers.generateId.mockReturnValue('g1');
  helpers.pickDate.mockResolvedValue('');
  await import('../js/lists.js');
});

describe('list postponing', () => {
  it('sets hiddenUntil based on selected option', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));

    const buttons = [...document.querySelectorAll('.postpone-option')];
    expect(buttons.some(btn => btn.textContent === '20 hours')).toBe(true);
    expect(buttons.some(btn => btn.textContent === 'Pick date…')).toBe(true);
    const option = buttons.find(btn => btn.textContent === '2 days');
    option.click();
    vi.advanceTimersByTime(300);

    expect(helpers.saveLists).toHaveBeenCalled();
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0];
    expect(saved.hiddenUntil).toBe(new Date('2023-01-03T00:00:00.000Z').toISOString());

    vi.useRealTimers();
  });

  it('sets hiddenUntil based on chosen date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));

    helpers.pickDate.mockResolvedValue('2023-01-10');
    const pickBtn = [...document.querySelectorAll('.postpone-option')].find(btn => btn.textContent === 'Pick date…');
    pickBtn.click();
    await Promise.resolve();
    vi.advanceTimersByTime(300);
    await Promise.resolve();

    expect(helpers.saveLists).toHaveBeenCalled();
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0];
    expect(saved.hiddenUntil).toBe(new Date('2023-01-10T00:00:00.000Z').toISOString());

    vi.useRealTimers();
  });
});

describe('openListsFormModal', () => {
  it('focuses the first input when modal opens', () => {
    window.openListsFormModal();
    const first = document.querySelector('#listsFormModal input, #listsFormModal textarea');
    expect(document.activeElement).toBe(first);
  });
});

describe('addListItemGoal', () => {
  it('creates goal from first column label', () => {
    const list = { name: 'Test', columns: [{ name: 'Item', type: 'text' }], items: [{ Item: 'Do it' }], hiddenUntil: null };
    helpers.loadLists.mockResolvedValue([list]);
    document.getElementById('listsPanel').innerHTML = '';
    vi.resetModules();
    return Promise.all([
      import('../js/helpers.js'),
      import('../js/goals.js'),
      import('../js/lists.js')
    ]).then(async ([h, g]) => {
      helpers = h;
      goals = g;
      helpers.loadDecisions.mockResolvedValue([]);
      helpers.generateId.mockReturnValue('g1');
      const btn = document.querySelector('button[title="Add as goal"]');
      btn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(helpers.saveDecisions).toHaveBeenCalled();
      const newGoal = helpers.saveDecisions.mock.calls[0][0].pop();
      expect(newGoal.text).toBe('Do it');
      expect(goals.appendGoalToDOM).toHaveBeenCalled();
    });
  });
});

describe('unhideListItem button', () => {
  it('clears hiddenUntil when clicked', async () => {
    const hideTime = '2030-01-01T00:00:00.000Z';
    document.getElementById('listsPanel').innerHTML = '';
    vi.resetModules();
    const [h, g] = await Promise.all([
      import('../js/helpers.js'),
      import('../js/goals.js'),
      import('../js/lists.js')
    ]);
    helpers = h;
    goals = g;
    helpers.loadLists.mockResolvedValue([{ name: 'Test', columns: [{ name: 'Item', type: 'text' }], items: [{ Item: 'One', hiddenUntil: hideTime }], hiddenUntil: null }]);
    vi.useFakeTimers();
    await window.initListsPanel();

    const btn = document.querySelector('#hiddenItemsContent button');
    expect(btn).toBeTruthy();
    btn.click();
    vi.advanceTimersByTime(300);
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0].items[0];
    expect(saved.hiddenUntil).toBe(null);
    vi.useRealTimers();
  });
});

describe('unhide list button', () => {
  it('clears list hiddenUntil when clicked', async () => {
    const hideTime = '2030-01-01T00:00:00.000Z';
    document.getElementById('listsPanel').innerHTML = '';
    vi.resetModules();
    const [h, g] = await Promise.all([
      import('../js/helpers.js'),
      import('../js/goals.js'),
      import('../js/lists.js')
    ]);
    helpers = h;
    goals = g;
    helpers.loadLists.mockResolvedValue([{ name: 'Hidden', columns: [], items: [], hiddenUntil: hideTime }]);
    helpers.loadDecisions.mockResolvedValue([]);
    vi.useFakeTimers();
    await window.initListsPanel();

    const btn = document.querySelector('#hiddenListsContent button');
    expect(btn).toBeTruthy();
    btn.click();
    vi.advanceTimersByTime(300);
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0];
    expect(saved.hiddenUntil).toBe(null);
    vi.useRealTimers();
  });
});
