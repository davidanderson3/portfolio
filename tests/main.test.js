import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(),
  saveDecisions: vi.fn(),
  generateId: vi.fn()
}));

vi.mock('../js/daily.js', () => ({ renderDailyTasks: vi.fn() }));
vi.mock('../js/goals.js', () => ({
  renderGoalsAndSubitems: vi.fn(),
  addCalendarGoal: vi.fn()
}));
vi.mock('../js/auth.js', () => ({ initAuth: vi.fn(), db: {}, currentUser: null }));
vi.mock('../js/wizard.js', () => ({ initWizard: vi.fn() }));
vi.mock('../js/report.js', () => ({ renderDailyTaskReport: vi.fn() }));
vi.mock('../js/stats.js', () => ({ initMetricsUI: vi.fn() }));
vi.mock('../js/tabs.js', () => ({ initTabs: vi.fn() }));
vi.mock('../js/buttonStyles.js', () => ({ initButtonStyles: vi.fn() }));
vi.mock('../js/tabReports.js', () => ({ initTabReports: vi.fn() }));
vi.mock('../js/googleCalendar.js', () => ({ initGoogleCalendar: vi.fn() }));
vi.mock('../js/settings.js', () => ({ loadHiddenTabs: vi.fn(), applyHiddenTabs: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
});

describe('bottom add button', () => {
  it('adds calendar goal when on calendar tab', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <button class="tab-button active" data-target="calendarPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };

    const goals = await import('../js/goals.js');
    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.getElementById('bottomAddBtn').click();
    expect(goals.addCalendarGoal).toHaveBeenCalled();
  });

  it('focuses text input when adding a daily task', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <div id="bottomAddModal" style="display:none;">
        <div id="bottomAddTitle"></div>
        <div id="bottomAddOptions"></div>
        <input id="bottomAddText" />
        <button id="bottomAddCancel"></button>
        <button id="bottomAddSubmit"></button>
      </div>
      <button class="tab-button active" data-target="dailyPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };
    global.window.quickAddTask = vi.fn();

    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.getElementById('bottomAddBtn').click();
    const text = dom.window.document.getElementById('bottomAddText');
    expect(dom.window.document.activeElement).toBe(text);
  });

  it('focuses metric input when adding a metric', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <div id="metricsConfigSection"></div>
      <button class="tab-button active" data-target="metricsPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };
    global.window.openMetricsConfigForm = () => {
      const sec = dom.window.document.getElementById('metricsConfigSection');
      sec.innerHTML = '<div id="configFormContainer"><input id="metricLabel"></div>';
      dom.window.document.getElementById('metricLabel').focus();
    };

    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'A', shiftKey: true }));
    const inp = dom.window.document.getElementById('metricLabel');
    expect(dom.window.document.activeElement).toBe(inp);
  });

});

describe('shift+A hotkey', () => {
  it('adds calendar goal when on calendar tab', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <button class="tab-button active" data-target="calendarPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };

    const goals = await import('../js/goals.js');
    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'A', shiftKey: true }));
    expect(goals.addCalendarGoal).toHaveBeenCalled();
  });

  it('focuses text input when adding a daily task', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <div id="bottomAddModal" style="display:none;">
        <div id="bottomAddTitle"></div>
        <div id="bottomAddOptions"></div>
        <input id="bottomAddText" />
        <button id="bottomAddCancel"></button>
        <button id="bottomAddSubmit"></button>
      </div>
      <button class="tab-button active" data-target="dailyPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };
    global.window.quickAddTask = vi.fn();

    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'A', shiftKey: true }));
    const text = dom.window.document.getElementById('bottomAddText');
    expect(dom.window.document.activeElement).toBe(text);
  });

  it('prevents default when no input is focused', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <button class="tab-button active" data-target="calendarPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };

    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    const evt = new dom.window.KeyboardEvent('keydown', { key: 'A', shiftKey: true, cancelable: true });
    const result = dom.window.document.dispatchEvent(evt);
    expect(result).toBe(false);
  });

  it('does not prevent default when typing in an input', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <input id="dummy" />
      <button class="tab-button active" data-target="goalsPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };

    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.getElementById('dummy').focus();
    const evt = new dom.window.KeyboardEvent('keydown', { key: 'A', shiftKey: true, cancelable: true });
    const result = dom.window.document.dispatchEvent(evt);
    expect(result).toBe(true);
  });

  it('focuses metric input when adding a metric', async () => {
    const dom = new JSDOM(`
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <div id="metricsConfigSection"></div>
      <button class="tab-button active" data-target="metricsPanel"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };
    global.window.openMetricsConfigForm = () => {
      const sec = dom.window.document.getElementById('metricsConfigSection');
      sec.innerHTML = '<div id="configFormContainer"><input id="metricLabel"></div>';
      dom.window.document.getElementById('metricLabel').focus();
    };

    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.getElementById('bottomAddBtn').click();
    const inp = dom.window.document.getElementById('metricLabel');
    expect(dom.window.document.activeElement).toBe(inp);
  });
});
