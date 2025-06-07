// js/wizard.js
import { parseNaturalDate } from './helpers.js';
import { generateId, loadDecisions, saveDecisions } from './decisionModel.js';
import { renderGoalsAndSubitems } from './render.js';

export const wizardState = {
  step: 0,
  goalText: '',
  importance: 5,
  deadline: '',
  decisions: [],
  decisionDependencies: {},
  additionalTasks: [],
  editingGoalId: null
};

export function initWizard({
  addGoalBtn, wizardContainer, wizardStep, nextBtn, backBtn, cancelBtn
}) {
  addGoalBtn.onclick = () => {
    Object.assign(wizardState, {
      step: 0,
      goalText: '',
      importance: 5,
      deadline: '',
      decisions: [],
      decisionDependencies: {},
      additionalTasks: [],
      editingGoalId: null
    });
    wizardContainer.style.display = 'block';
    addGoalBtn.style.display = 'none';
    renderWizardStep(wizardStep, backBtn);
  };

  cancelBtn.onclick = () => {
    wizardContainer.style.display = 'none';
    addGoalBtn.style.display = 'inline-block';
  };

  backBtn.onclick = () => {
    wizardState.step--;
    renderWizardStep(wizardStep, backBtn);
  };

  nextBtn.onclick = async () => {
    if (wizardState.step === 0) {
      wizardState.goalText = document.getElementById('goalTextInput').value.trim();
      if (!wizardState.goalText) return alert("Goal cannot be empty.");
    } else if (wizardState.step === 1) {
      const selected = document.querySelector('input[name="importance"]:checked');
      if (!selected) return alert("Please select an importance value.");
      wizardState.importance = parseInt(selected.value);
    } else if (wizardState.step === 2) {
      const rawInput = document.getElementById('deadlineInput').value.trim();
      wizardState.deadline = parseNaturalDate(rawInput) || rawInput;
    } else if (wizardState.step === 3) {
      wizardState.decisions = document.getElementById('decisionList').value
        .split('\n').map(x => x.trim()).filter(Boolean);
    } else if (wizardState.step >= 4 && wizardState.step < 4 + wizardState.decisions.length) {
      const current = wizardState.decisions[wizardState.step - 4];
      wizardState.decisionDependencies[current] = document.getElementById('depList').value
        .split('\n').map(x => x.trim()).filter(Boolean);
    } else {
      wizardState.additionalTasks = document.getElementById('taskList').value
        .split('\n').map(x => x.trim()).filter(Boolean);
      await saveGoalWizard();
      return;
    }

    wizardState.step++;
    renderWizardStep(wizardStep, backBtn);
  };
}

function renderWizardStep(wizardStep, backBtn) {
  wizardStep.innerHTML = '';
  backBtn.style.display = wizardState.step > 0 ? 'inline-block' : 'none';

  if (wizardState.step === 0) {
    wizardStep.innerHTML = `
      <label for="goalTextInput"><strong>Goal:</strong></label>
      <input id="goalTextInput" value="${wizardState.goalText}" style="margin-left:8px; width: 80%;" />
    `;
  } else if (wizardState.step === 1) {
    wizardStep.innerHTML = `
      <label>How important is this goal? (1 = least, 10 = most)</label>
      <div id="importanceRadios" style="margin-top:8px; display:flex; flex-direction:row; gap:12px;">
        ${[...Array(10)].map((_, i) => `
          <label style="display:inline-flex; align-items:center;">
            <input type="radio" name="importance" value="${i + 1}" ${wizardState.importance == (i + 1) ? 'checked' : ''} />
            <span style="margin-left:6px;">${i + 1}</span>
          </label>
        `).join('')}
      </div>
    `;
    setTimeout(() => {
      document.querySelectorAll('#importanceRadios input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', e => {
          wizardState.importance = parseInt(e.target.value);
        });
      });
    }, 0);
  } else if (wizardState.step === 2) {
    wizardStep.innerHTML = `
      <label for="deadlineInput">Deadline (optional):</label>
      <input type="date" id="deadlineInput" value="${wizardState.deadline}" style="margin-left:8px;" />
    `;
  } else if (wizardState.step === 3) {
    wizardStep.innerHTML = `
      <label>What decisions are necessary to complete this goal?</label>
      <textarea id="decisionList" rows="4" placeholder="One per line">${wizardState.decisions.join('\n')}</textarea>
      <div style="margin-top:10px;">
        <button type="button" id="addDecisionBtn">Add decision</button>
        <button type="button" id="addTaskBtn" style="margin-left:10px;">Add task</button>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('addDecisionBtn').onclick = () => {
        const textarea = document.getElementById('decisionList');
        textarea.value += (textarea.value.trim() ? '\n' : '') + 'New decision';
        textarea.focus();
      };
      document.getElementById('addTaskBtn').onclick = () => {
        alert('Tasks can be added in the next step!');
      };
    }, 0);
  } else if (wizardState.step >= 4 && wizardState.step < 4 + wizardState.decisions.length) {
    const current = wizardState.decisions[wizardState.step - 4];
    const existing = (wizardState.decisionDependencies[current] || []).join('\n');
    wizardStep.innerHTML = `
      <label>Dependencies for decision: <strong>${current}</strong></label>
      <textarea id="depList" rows="4" placeholder="One per line">${existing}</textarea>
    `;
  } else {
    wizardStep.innerHTML = `
      <label>Any additional tasks for this goal?</label>
      <textarea id="taskList" rows="4" placeholder="One per line">${wizardState.additionalTasks.join('\n')}</textarea>
    `;
  }
}

async function saveGoalWizard() {
  const all = await loadDecisions();
  const isEdit = !!wizardState.editingGoalId;
  const goalId = isEdit ? wizardState.editingGoalId : generateId();
  const newList = isEdit
    ? all.filter(item => item.id !== goalId && item.parentGoalId !== goalId)
    : all;

  const newItems = [{
    id: goalId,
    type: 'goal',
    text: wizardState.goalText,
    importance: wizardState.importance,
    deadline: wizardState.deadline,
    dependencies: [],
    parentGoalId: null,
    completed: false,
    resolution: '',
    dateCompleted: ''
  }];

  const decisionIdMap = {};
  wizardState.decisions.forEach(text => {
    const id = generateId();
    decisionIdMap[text] = id;
    newItems.push({
      id, type: 'decision', text, parentGoalId: goalId,
      dependencies: [], completed: false, resolution: '', dateCompleted: ''
    });
  });

  newItems.forEach(item => {
    if (item.type === 'decision') {
      const deps = wizardState.decisionDependencies[item.text] || [];
      item.dependencies = deps.map(depText => {
        if (decisionIdMap[depText]) return decisionIdMap[depText];
        const id = generateId();
        newItems.push({
          id, type: 'task', text: depText, parentGoalId: goalId,
          dependencies: [], completed: false, resolution: '', dateCompleted: ''
        });
        return id;
      });
    }
  });

  wizardState.additionalTasks.forEach(text => {
    newItems.push({
      id: generateId(), type: 'task', text, parentGoalId: goalId,
      dependencies: [], completed: false, resolution: '', dateCompleted: ''
    });
  });

  await saveDecisions([...newList, ...newItems]);
  wizardState.editingGoalId = null;
  document.getElementById('goalWizard').style.display = 'none';
  document.getElementById('addGoalBtn').style.display = 'inline-block';
  renderGoalsAndSubitems();
}
