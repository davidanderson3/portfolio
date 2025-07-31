import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

var currentUser;
var setMock;
var getMock;
var docMock;
var collectionMock;

vi.mock('../js/auth.js', () => ({
  getCurrentUser: () => currentUser,
  db: { collection: (...args) => collectionMock(...args) }
}));

currentUser = null;
setMock = vi.fn();
getMock = vi.fn();
docMock = vi.fn(() => ({ collection: collectionMock, doc: docMock, get: getMock, set: setMock }));
collectionMock = vi.fn(() => ({ doc: docMock }));

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

describe('planning UI persistence', () => {
  it('restores saved values after reload and auth change', async () => {
    let dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'returnRate', 'withdrawalRate', 'postYears', 'high3', 'serviceYears', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'roth', 'crypto', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod1 = await import('../js/planning.js');
    await mod1.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.curAge.value = '30';
    form.realEstate.value = '100000';
    form.checking.value = '2500';
    form.annualSavings.value = '5000';
    form.annualRaise.value = '5';
    form.withdrawalRate.value = '6';
    form.postYears.value = '20';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    const saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.finance.curAge).toBe('30');
    expect(saved.assets.realEstate).toBe(100000);
    expect(saved.assets.checking).toBe(2500);
    expect(saved.finance.annualSavings).toBe(5000);
    expect(saved.finance.annualRaise).toBe('5');
    expect(saved.finance.withdrawalRate).toBe(6);
    expect(saved.finance.postYears).toBe(20);

    mod1.clearPlanningCache();
    currentUser = { uid: 'u1' };

    dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });
    vi.resetModules();
    const mod2 = await import('../js/planning.js');
    await mod2.initPlanningPanel();

    const age2 = document.querySelector('#planningForm input[name="curAge"]').value;
    const estate2 = document.querySelector('#planningForm input[name="realEstate"]').value;
    const checking2 = document.querySelector('#planningForm input[name="checking"]').value;
    const annual2 = document.querySelector('#planningForm input[name="annualSavings"]').value;
    const raise2 = document.querySelector('#planningForm input[name="annualRaise"]').value;
    const wd2 = document.querySelector('#planningForm input[name="withdrawalRate"]').value;
    const post2 = document.querySelector('#planningForm input[name="postYears"]').value;
    expect(age2).toBe('30');
    expect(estate2).toBe('100000');
    expect(checking2).toBe('2500');
    expect(annual2).toBe('5000');
    expect(raise2).toBe('5');
    expect(wd2).toBe('6');
    expect(post2).toBe('20');
  });

  it('records history when asset totals change', async () => {
    vi.resetModules();
    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'returnRate', 'withdrawalRate', 'postYears', 'high3', 'serviceYears', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'roth', 'crypto', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.curAge.value = '30';
    form.realEstate.value = '1000';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    let saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(2);
    const firstTs = saved.history[0].timestamp;
    expect(typeof firstTs).toBe('string');

    form.realEstate.value = '2000';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));
    saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(3);
    const last = saved.history[saved.history.length - 1];
    expect(last.balance).toBe(2000);
    expect(typeof last.timestamp).toBe('string');
    expect(last.timestamp).not.toBe(firstTs);
  });
});
