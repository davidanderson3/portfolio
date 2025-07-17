import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadLists: vi.fn(),
  saveLists: vi.fn()
}));

vi.mock('../js/auth.js', () => ({
  auth: { onAuthStateChanged: (cb) => cb() },
  db: {}
}));

let helpers;

beforeEach(async () => {
  vi.resetModules();
  const dom = new JSDOM('<div id="listsPanel"></div><div id="listsFormModal"><div id="listsFormWrapper"></div></div><button class="tab-button active" data-target="listsPanel"></button>');
  global.window = dom.window;
  global.document = dom.window.document;
  helpers = await import('../js/helpers.js');
  helpers.loadLists.mockResolvedValue([{ name: 'Test', columns: [], items: [], hiddenUntil: null }]);
  await import('../js/lists.js');
});

describe('list postponing', () => {
  it('sets hiddenUntil based on selected option', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));

    const option = [...document.querySelectorAll('.postpone-option')]
      .find(btn => btn.textContent === '2 days');
    option.click();
    vi.advanceTimersByTime(300);

    expect(helpers.saveLists).toHaveBeenCalled();
    const saved = helpers.saveLists.mock.calls[0][0][0];
    expect(saved.hiddenUntil).toBe(new Date('2023-01-03T00:00:00.000Z').toISOString());

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
