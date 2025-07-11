import { describe, it, expect, vi, beforeEach } from 'vitest';

const createEventMock = vi.fn();
const getMock = vi.fn();

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(async () => []),
  saveDecisions: vi.fn(async () => {}),
  saveGoalOrder: vi.fn(async () => {}),
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
  getMock.mockClear();
  global.firebase = {
    firestore: () => ({
      collection: () => ({
        doc: () => ({ get: getMock })
      })
    }),
    auth: () => ({ currentUser: { uid: 'user1' } })
  };
  getMock.mockResolvedValue({ data: () => ({ goalOrder: [] }) });
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
      calendarDate: '2024-01-02',
      subgoals: [],
      editingGoalId: null
    });

    await saveGoalWizard();
    expect(createEventMock).toHaveBeenCalledWith('My goal', '2024-01-02', '');
  });
});
