import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({ currentUser: null }));

beforeEach(() => {
  vi.resetModules();
});

describe('initTabs persistence', () => {
  it('activates the last selected panel from localStorage', async () => {
    const dom = new JSDOM(`
      <button class="tab-button" data-target="projectsPanel"></button>
      <button class="tab-button" data-target="calendarPanel"></button>
      <button class="tab-button" data-target="dailyPanel"></button>
      <button class="tab-button" data-target="metricsPanel"></button>
      <button class="tab-button" data-target="listsPanel"></button>
      <button class="tab-button" data-target="travelPanel"></button>
      <button class="tab-button" data-target="planningPanel"></button>
      <button class="tab-button" data-target="budgetPanel"></button>
      <div id="projectsPanel"></div>
      <div id="calendarPanel"></div>
      <div id="dailyPanel"></div>
      <div id="metricsPanel"></div>
      <div id="listsPanel"></div>
      <div id="travelPanel"></div>
      <div id="planningPanel"></div>
      <div id="budgetPanel"></div>
    `, { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;

    const storage = (() => {
      let store = {};
      return {
        getItem: key => (key in store ? store[key] : null),
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: key => { delete store[key]; },
        clear: () => { store = {}; }
      };
    })();
    global.localStorage = storage;

    localStorage.setItem('lastPanel', 'dailyPanel');

    global.window.renderDailyTasks = vi.fn();
    global.window.initMetricsUI = vi.fn();
    global.window.initListsPanel = vi.fn();
    global.window.initTravelPanel = vi.fn();
    global.window.initPlanningPanel = vi.fn();

    const mod = await import('../js/tabs.js');
    mod.initTabs(null, {});
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const dailyBtn = document.querySelector('.tab-button[data-target="dailyPanel"]');
    expect(dailyBtn.classList.contains('active')).toBe(true);
    expect(document.getElementById('dailyPanel').style.display).toBe('flex');
  });
});
