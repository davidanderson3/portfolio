// js/wizard.js
import { parseNaturalDate } from './helpers.js';
import { generateId, loadDecisions, saveDecisions, saveGoalOrder } from './decisionModel.js';
import { renderGoalsAndSubitems } from './render.js';
import { getCurrentUser } from './auth.js';

export const wizardState = {
  step: 0,
  goalText: '',
  deadline: '',
  subtasks: [],
  editingGoalId: null
};

let wizardContainer = null;
let addGoalBtn = null;

export function initWizard(uiRefs) {
  ({ wizardContainer, addGoalBtn } = uiRefs);

  uiRefs.addGoalBtn.onclick = () => {
    Object.assign(wizardState, {
      step: 0,
      goalText: '',
      deadline: '',
      subtasks: [],
      editingGoalId: null
    });
    wizardContainer.style.display = 'block';
    addGoalBtn.style.display = 'none';
    renderWizardStep(uiRefs.wizardStep, uiRefs.backBtn);
  };

  uiRefs.cancelBtn.onclick = () => {
    wizardContainer.style.display = 'none';
    addGoalBtn.style.display = 'inline-block';
  };

  uiRefs.backBtn.onclick = () => {
    wizardState.step--;
    renderWizardStep(uiRefs.wizardStep, uiRefs.backBtn);
  };

  uiRefs.nextBtn.onclick = async () => {
    if (wizardState.step === 0) {
      wizardState.goalText = document.getElementById('goalTextInput').value.trim();
      if (!wizardState.goalText) return alert("Goal cannot be empty.");
    } else if (wizardState.step === 1) {
      wizardState.deadline = document.getElementById('deadlineInput').value.trim();
    } else {
      wizardState.subtasks = document.getElementById('taskList').value
        .split('\n').map(t => t.trim()).filter(Boolean);
      await saveGoalWizard();
      return;
    }

    wizardState.step++;
    renderWizardStep(uiRefs.wizardStep, uiRefs.backBtn);
  };
}

function renderWizardStep(container, backBtn) {
  container.innerHTML = '';
  backBtn.style.display = wizardState.step > 0 ? 'inline-block' : 'none';

  if (wizardState.step === 0) {
    container.innerHTML = `
      <label for="goalTextInput"><strong>Goal:</strong></label>
      <input id="goalTextInput" value="${wizardState.goalText}" style="margin-left:8px; width: 80%;" />
    `;
  } else if (wizardState.step === 1) {
    container.innerHTML = `
      <label for="deadlineInput">Deadline (optional):</label>
      <input type="date" id="deadlineInput" value="${wizardState.deadline}" style="margin-left:8px;" />
    `;
  } else {
    container.innerHTML = `
      <label>Subtasks (optional):</label>
      <textarea id="taskList" rows="4" placeholder="One per line">${wizardState.subtasks.join('\n')}</textarea>
    `;
  }
}

async function saveGoalWizard() {
  const all = await loadDecisions();
  const user = getCurrentUser();
  if (!user) return;

  const isEdit = !!wizardState.editingGoalId;
  const goalId = isEdit ? wizardState.editingGoalId : generateId();

  const newGoal = {
    id: goalId,
    type: 'goal',
    text: wizardState.goalText,
    deadline: wizardState.deadline,
    completed: false,
    resolution: '',
    dateCompleted: '',
    parentGoalId: null,
    hiddenUntil: null
  };

  const newItems = [newGoal];

  wizardState.subtasks.forEach(taskText => {
    newItems.push({
      id: generateId(),
      type: 'task',
      text: taskText,
      deadline: '',
      completed: false,
      resolution: '',
      dateCompleted: '',
      parentGoalId: goalId,
      hiddenUntil: null
    });
  });

  const updatedItems = isEdit
    ? all.filter(item => item.id !== goalId && item.parentGoalId !== goalId)
    : all;

  await saveDecisions([...updatedItems, ...newItems]);

  const snap = await db.collection('decisions').doc(user.uid).get();
  const currentGoalOrder = snap.data()?.goalOrder || [];
  const newGoalOrder = isEdit
    ? currentGoalOrder
    : [...currentGoalOrder, goalId];
  await saveGoalOrder(newGoalOrder);

  wizardState.editingGoalId = null;
  wizardContainer.style.display = 'none';
  addGoalBtn.style.display = 'inline-block';
  renderGoalsAndSubitems();
}
