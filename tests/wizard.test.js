import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

const createEventMock = vi.fn();

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(async () => []),
  saveDecisions: vi.fn(async () => {}),
  saveGoalOrder: vi.fn(async () => {}),
  loadGoalOrder: vi.fn(async () => []),
  generateId: vi.fn(() => 'id1'),
  parseNaturalDate: vi.fn()
}));

vi.mock('../js/goals.js', () => ({
  renderGoalsAndSubitems: vi.fn(),
  appendGoalToDOM: vi.fn()
}));

vi.mock('../js/googleCalendar.js', () => ({ createCalendarEvent: createEventMock }));

beforeEach(() => {
  vi.resetModules();
  createEventMock.mockClear();
  global.firebase = {
    auth: () => ({ currentUser: { uid: 'user1' } })
  };
  global.prompt = vi.fn(() => '');
});

describe('saveGoalWizard', () => {
  it('creates calendar event when scheduled', async () => {
    const mod = await import('../js/wizard.js');
    const { wizardState, initWizard, saveGoalWizard } = mod;
    initWizard({
      wizardContainer: { style: {} },
      addGoalBtn: { style: {} },
      cancelBtn: {},
      backBtn: { style: {} },
      nextBtn: {},
      wizardStep: {}
    });

  Object.assign(wizardState, {
      goalText: 'My goal',
      calendarStartDate: '2024-01-02',
      calendarEndDate: '',
      subgoals: [],
      editingGoalId: null
    });

    await saveGoalWizard();
    expect(createEventMock).toHaveBeenCalledWith('My goal', '2024-01-02', '2024-01-02', '');
  });
});

describe('initWizard', () => {
  it('focuses first input when wizard opens', async () => {
    const dom = new JSDOM(`
      <div id="goalWizardModal" style="display:none;"></div>
      <div id="wizardStep"></div>
      <button id="wizardNextBtn"></button>
      <button id="wizardBackBtn"></button>
      <button id="wizardCancelBtn"></button>
      <button id="addGoalBtn"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;

    const mod = await import('../js/wizard.js');
    const { initWizard } = mod;
    initWizard({
      wizardContainer: document.getElementById('goalWizardModal'),
      addGoalBtn: document.getElementById('addGoalBtn'),
      cancelBtn: document.getElementById('wizardCancelBtn'),
      backBtn: document.getElementById('wizardBackBtn'),
      nextBtn: document.getElementById('wizardNextBtn'),
      wizardStep: document.getElementById('wizardStep')
    });

    document.getElementById('addGoalBtn').click();
    expect(document.activeElement.id).toBe('goalTextInput');
  });
});
