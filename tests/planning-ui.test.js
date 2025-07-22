import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// auth.js mock using variable user state
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

// simple localStorage mock
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
    // initial anonymous load
    let dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;

    const names = [
      'curAge', 'retAge', 'income', 'expenses', 'returnRate',
      'hobbyHours', 'workHours', 'realEstate', 'carValue', 'assetSavings', 'investment'
    ];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod1 = await import('../js/planning.js');
    await mod1.initPlanningPanel();

    const financeForm = document.querySelector('.finance-form');
    const happyForm = document.querySelector('.happy-form');
    const assetsForm = document.querySelector('#assetsForm');

    const nameInput = document.querySelector('.profile-name');
    nameInput.value = 'Tester';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const ageInput = document.querySelector('.finance-form input[name="curAge"]');
    ageInput.value = '30';
    ageInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const hobbyInput = document.querySelector('.happy-form input[name="hobbyHours"]');
    hobbyInput.value = '5';
    hobbyInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assetsForm.realEstate.value = '100000';
    assetsForm.realEstate.dispatchEvent(new window.Event('input', { bubbles: true }));
    assetsForm.carValue.value = '10000';
    assetsForm.carValue.dispatchEvent(new window.Event('input', { bubbles: true }));
    assetsForm.assetSavings.value = '5000';
    assetsForm.assetSavings.dispatchEvent(new window.Event('input', { bubbles: true }));
    assetsForm.investment.value = '20000';
    assetsForm.investment.dispatchEvent(new window.Event('input', { bubbles: true }));

    const saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.profiles[0].finance.curAge).toBe('30');
    expect(saved.assets.realEstate).toBe(100000);
    expect(saved.assets.carValue).toBe(10000);
    expect(saved.assets.assetSavings).toBe(5000);
    expect(saved.assets.investment).toBe(20000);

    // simulate login and page reload
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

    const name2 = document.querySelector('.profile-name').value;
    const age2 = document.querySelector('.finance-form input[name="curAge"]').value;
    const hobby2 = document.querySelector('.happy-form input[name="hobbyHours"]').value;
    const assetsForm2 = document.querySelector('#assetsForm');
    const realEstate2 = assetsForm2.realEstate.value;
    const car2 = assetsForm2.carValue.value;
    const saving2 = assetsForm2.assetSavings.value;
    const invest2 = assetsForm2.investment.value;

    expect(name2).toBe('Tester');
    expect(age2).toBe('30');
    expect(hobby2).toBe('5');
    expect(realEstate2).toBe('100000');
    expect(car2).toBe('10000');
    expect(saving2).toBe('5000');
    expect(invest2).toBe('20000');
  });
});
