const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const addGoalBtn = document.getElementById('addGoalBtn');
const wizardContainer = document.getElementById('goalWizard');
const wizardStep = document.getElementById('wizardStep');
const nextBtn = document.getElementById('wizardNextBtn');
const backBtn = document.getElementById('wizardBackBtn');
const cancelBtn = document.getElementById('wizardCancelBtn');
const completedList = document.getElementById('completedList');
const goalList = document.getElementById('goalList');

let justRevisited = null;
let currentUser = null;

const wizardState = {
  step: 0,
  goalText: '',
  importance: 5,
  deadline: '',
  decisions: [],
  decisionDependencies: {},
  additionalTasks: []
};

function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

const PLACEHOLDERS = {
  decisionText: "Describe the decision...",
  dependsOn: "Does this depend on another decision?",
  tasks: "Tasks required for this decision"
};

// --- Wizard Flow ---
addGoalBtn.onclick = () => {
  wizardState.step = 0;
  wizardState.goalText = '';
  wizardState.importance = 5;
  wizardState.deadline = '';
  wizardState.decisions = [];
  wizardState.decisionDependencies = {};
  wizardState.additionalTasks = [];

  wizardContainer.style.display = 'block';
  addGoalBtn.style.display = 'none';
  renderWizardStep();
};

cancelBtn.onclick = () => {
  wizardContainer.style.display = 'none';
  addGoalBtn.style.display = 'inline-block';
};

backBtn.onclick = () => {
  wizardState.step--;
  renderWizardStep();
};

nextBtn.onclick = () => {
  if (wizardState.step === 0) {
    wizardState.goalText = document.getElementById('goalTextInput').value.trim();
    if (!wizardState.goalText) return alert("Goal cannot be empty.");
  } else if (wizardState.step === 1) {
    wizardState.importance = parseInt(document.getElementById('importanceInput').value);
  } else if (wizardState.step === 2) {
    const rawInput = document.getElementById('deadlineInput').value.trim();
    const parsed = parseNaturalDate(rawInput);
    wizardState.deadline = parsed || rawInput;
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
    saveGoalWizard();
    return;
  }

  wizardState.step++;
  renderWizardStep();
};


function renderWizardStep() {
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
        // Optionally, you could add a task to a separate list or append a marker in the textarea
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

  // Filter out the goal and its children if editing
  let newList = isEdit
    ? all.filter(item => item.id !== goalId && item.parentGoalId !== goalId)
    : all;

  const newGoal = {
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
  };

  const newItems = [newGoal];
  const decisionIdMap = {};

  // Add decisions
  wizardState.decisions.forEach(decText => {
    const id = generateId();
    decisionIdMap[decText] = id;

    newItems.push({
      id,
      type: 'decision',
      text: decText,
      parentGoalId: goalId,
      dependencies: [],
      completed: false,
      resolution: '',
      dateCompleted: ''
    });
  });

  // Resolve dependencies and auto-create tasks if needed
  newItems.forEach(item => {
    if (item.type === 'decision') {
      const deps = wizardState.decisionDependencies[item.text] || [];
      item.dependencies = deps.map(depText => {
        // Resolve decision dependency
        if (decisionIdMap[depText]) return decisionIdMap[depText];

        // Create a task if not already mapped
        const taskId = generateId();
        newItems.push({
          id: taskId,
          type: 'task',
          text: depText,
          parentGoalId: goalId,
          dependencies: [],
          completed: false,
          resolution: '',
          dateCompleted: ''
        });
        return taskId;
      });
    }
  });

  // Add additional tasks
  wizardState.additionalTasks.forEach(taskText => {
    const id = generateId();
    newItems.push({
      id,
      type: 'task',
      text: taskText,
      parentGoalId: goalId,
      dependencies: [],
      completed: false,
      resolution: '',
      dateCompleted: ''
    });
  });

  // Save and reset
  await saveDecisions([...newList, ...newItems]);

  wizardState.editingGoalId = null;
  wizardContainer.style.display = 'none';
  addGoalBtn.style.display = 'inline-block';
  renderGoalsAndSubitems();
}


function parseNaturalDate(input) {
  const today = new Date();
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const normalized = input.trim().toLowerCase();

  if (normalized === 'today') {
    return today.toISOString().split('T')[0];
  }

  const match = weekdays.find(d => normalized.startsWith(d));
  if (match) {
    const targetDay = weekdays.indexOf(match);
    const currentDay = today.getDay();
    let delta = targetDay - currentDay;
    if (delta <= 0) delta += 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + delta);
    return nextDate.toISOString().split('T')[0];
  }

  return null;
}



// --- Core Logic ---
async function loadDecisions() {
  if (!currentUser) return [];
  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  return data && Array.isArray(data.list) ? data.list : [];
}

async function saveDecisions(decisions) {
  if (!currentUser || !Array.isArray(decisions)) return;
  await db.collection('decisions').doc(currentUser.uid).set({ list: decisions });
}

function formatDaysUntil(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  return `overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
}

function topologicalSort(items) {
  const graph = new Map();
  const inDegree = new Map();

  items.forEach(item => {
    graph.set(item.id, []);
    inDegree.set(item.id, 0);
  });

  items.forEach(item => {
    const deps = Array.isArray(item.dependencies) ? item.dependencies : [];
    deps.forEach(depId => {
      if (graph.has(depId)) {
        graph.get(depId).push(item.id);
        inDegree.set(item.id, (inDegree.get(item.id) || 0) + 1);
      }
    });
  });

  const queue = [];
  inDegree.forEach((deg, key) => {
    if (deg === 0) queue.push(key);
  });

  const ordered = [];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentItem = items.find(i => i.id === currentId);
    if (currentItem) ordered.push(currentItem);

    (graph.get(currentId) || []).forEach(neighborId => {
      inDegree.set(neighborId, inDegree.get(neighborId) - 1);
      if (inDegree.get(neighborId) === 0) queue.push(neighborId);
    });
  }

  return ordered;
}

async function renderGoalsAndSubitems() {
  const all = await loadDecisions();
  const sorted = topologicalSort(all);

  goalList.innerHTML = '';
  completedList.innerHTML = '';

function renderItem(item, indentLevel = 0) {
  const wrapper = document.createElement('div');

  if (item.completed && item.type === 'decision') {
    wrapper.className = 'decision completed-decision-inline';
  } else if (item.completed) {
    wrapper.className = 'completed-decision';
  } else {
    wrapper.className = 'decision';
  }

  wrapper.classList.add(`indent-${indentLevel}`);

  const row = document.createElement('div');
  row.className = 'decision-row';

  const dueText = formatDaysUntil(item.deadline);

  if (item.completed && item.type === 'decision') {
    row.innerHTML = `
      <div class="check-column"><input type="checkbox" checked disabled /></div>
      <div class="title-column">
        <strong>Decision:</strong> ${item.text}<br/>
        <strong>Outcome:</strong> ${item.resolution}
      </div>
      <div class="due-column">${item.dateCompleted}</div>
      <div class="arrow-column">✔</div>
    `;
  } else {
    row.innerHTML = `
      <div class="check-column">
        <input type="checkbox" ${item.completed ? 'checked disabled' : ''} />
      </div>
      <div class="title-column">${item.text}</div>
      <div class="due-column">${dueText}</div>
      <div class="arrow-column">▶</div>
    `;
  }

  const checkbox = row.querySelector('input[type="checkbox"]');
  if (!item.completed) {
    checkbox.onchange = async () => {
      const resolution = prompt(`Mark complete: ${item.text}`);
      if (!resolution) {
        checkbox.checked = false;
        return;
      }
      item.completed = true;
      item.resolution = resolution;
      item.dateCompleted = new Date().toISOString().split('T')[0];
      const updated = await loadDecisions();
      const idx = updated.findIndex(d => d.id === item.id);
      updated[idx] = item;
      await saveDecisions(updated);
      renderGoalsAndSubitems();
    };
  }

  if (item.type === 'goal') {
    const actionCell = document.createElement('div');
    actionCell.className = 'edit-column';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'edit-btn';
    actionCell.appendChild(editBtn);
    row.appendChild(actionCell);

    let isEditing = false;

    editBtn.onclick = async () => {
      if (!isEditing) {
        isEditing = true;
        editBtn.textContent = 'Save';

        const textCell = row.querySelector('.title-column');
        const dueCell = row.querySelector('.due-column');

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = item.text;
        textInput.style.width = '100%';

        const deadlineInput = document.createElement('input');
        deadlineInput.type = 'date';
        deadlineInput.value = item.deadline || '';
        deadlineInput.style.width = '140px';

        const importanceLabel = document.createElement('label');
        importanceLabel.textContent = 'Importance:';
        importanceLabel.style.marginLeft = '8px';

        const importanceRadios = document.createElement('div');
        importanceRadios.style.display = 'flex';
        importanceRadios.style.flexDirection = 'row';
        importanceRadios.style.gap = '12px';
        importanceRadios.style.marginLeft = '8px';
        importanceRadios.innerHTML = [...Array(10)].map((_, i) => `
          <label style="display:inline-flex; align-items:center;">
            <input type="radio" name="importanceEdit${item.id}" value="${i + 1}" ${item.importance == (i + 1) ? 'checked' : ''} />
            <span style="margin-left:6px;">${i + 1}</span>
          </label>
        `).join('');

        textCell.innerHTML = '';
        textCell.appendChild(textInput);
        textCell.appendChild(importanceLabel);
        textCell.appendChild(importanceRadios);

        dueCell.innerHTML = '';
        dueCell.appendChild(deadlineInput);

        const depContainer = document.createElement('div');
        depContainer.style.marginTop = '12px';

        // Show current decisions and tasks
        const children = (await loadDecisions()).filter(i => i.parentGoalId === item.id);
        const decisions = children.filter(i => i.type === 'decision');
        const tasks = children.filter(i => i.type === 'task');

        const decisionList = document.createElement('ul');
        decisionList.style.margin = '8px 0';
        decisionList.innerHTML = decisions.map(d => `<li>${d.text}</li>`).join('');
        depContainer.appendChild(document.createTextNode('Decisions:'));
        depContainer.appendChild(decisionList);

        const taskList = document.createElement('ul');
        taskList.style.margin = '8px 0';
        taskList.innerHTML = tasks.map(t => `<li>${t.text}</li>`).join('');
        depContainer.appendChild(document.createTextNode('Tasks:'));
        depContainer.appendChild(taskList);

        // Add buttons
        const addDecisionBtn = document.createElement('button');
        addDecisionBtn.textContent = 'Add decision';
        addDecisionBtn.style.marginRight = '10px';

        const addTaskBtn = document.createElement('button');
        addTaskBtn.textContent = 'Add task';

        depContainer.appendChild(addDecisionBtn);
        depContainer.appendChild(addTaskBtn);

        textCell.appendChild(depContainer);

        addDecisionBtn.onclick = async () => {
          const newText = prompt('Enter new decision:');
          if (newText && newText.trim()) {
            const updated = await loadDecisions();
            updated.push({
              id: generateId(),
              type: 'decision',
              text: newText.trim(),
              parentGoalId: item.id,
              dependencies: [],
              completed: false,
              resolution: '',
              dateCompleted: ''
            });
            await saveDecisions(updated);
            renderGoalsAndSubitems();
          }
        };

        addTaskBtn.onclick = async () => {
          const newText = prompt('Enter new task:');
          if (newText && newText.trim()) {
            const updated = await loadDecisions();
            updated.push({
              id: generateId(),
              type: 'task',
              text: newText.trim(),
              parentGoalId: item.id,
              dependencies: [],
              completed: false,
              resolution: '',
              dateCompleted: ''
            });
            await saveDecisions(updated);
            renderGoalsAndSubitems();
          }
        };
      } else {
        // Save changes
        const text = row.querySelector('input[type="text"]').value.trim();
        const deadlineRaw = row.querySelector('.due-column input').value.trim();
        const parsedDeadline = parseNaturalDate(deadlineRaw) || deadlineRaw;
        const importance = parseInt(row.querySelector('input[type="radio"][name="importanceEdit' + item.id + '"]:checked').value);

        const updated = await loadDecisions();
        const idx = updated.findIndex(d => d.id === item.id);
        if (idx !== -1) {
          updated[idx].text = text;
          updated[idx].deadline = parsedDeadline;
          updated[idx].importance = importance;
          await saveDecisions(updated);
        }

        isEditing = false;
        renderGoalsAndSubitems();
      }
    };
  }

  wrapper.appendChild(row);

  // Always show all items (even completed)
  goalList.appendChild(wrapper);

  // Recursively render child items
  all
    .filter(child => child.parentGoalId === item.id)
    .forEach(child => renderItem(child, indentLevel + 1));
}


  // Render only root-level goals
  sorted
    .filter(i => i.type === 'goal')
    .forEach(goal => renderItem(goal, 0));
}


// --- Auth ---
loginBtn.onclick = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider, undefined, firebase.auth.browserPopupRedirectResolver);
    currentUser = result.user;
    userEmail.textContent = currentUser.email;
    await renderGoalsAndSubitems();
  } catch (err) {
    console.error('Login failed:', err);
  }
};

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    userEmail.textContent = user.email;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    renderGoalsAndSubitems();
  } else {
    currentUser = null;
    userEmail.textContent = '';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
});

function startGoalEdit(goalId) {
  loadDecisions().then(items => {
    const goal = items.find(i => i.id === goalId && i.type === 'goal');
    if (!goal) return;

    const children = items.filter(i => i.parentGoalId === goalId);

    wizardState.step = 0;
    wizardState.goalText = goal.text;
    wizardState.importance = goal.importance || 5;
    wizardState.deadline = goal.deadline || '';

    wizardState.decisions = children.filter(i => i.type === 'decision').map(d => d.text);
    wizardState.additionalTasks = children.filter(i => i.type === 'task').map(t => t.text);

    wizardState.decisionDependencies = {};
    children.filter(i => i.type === 'decision').forEach(d => {
      wizardState.decisionDependencies[d.text] = d.dependencies || [];
    });

    wizardState.editingGoalId = goalId;

    wizardContainer.style.display = 'block';
    addGoalBtn.style.display = 'none';
    renderWizardStep();
  });
}


logoutBtn.onclick = async () => {
  await auth.signOut();
  currentUser = null;
  userEmail.textContent = '';
  loginBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  goalList.innerHTML = '';
  completedList.innerHTML = '';
};

window.addEventListener('load', () => {
  renderGoalsAndSubitems();
});

// Helper to create and handle the inline form
function showInlineForm(type) {
  // Remove any existing form
  const existing = depContainer.querySelector('.inline-add-form');
  if (existing) existing.remove();

  const form = document.createElement('form');
  form.className = 'inline-add-form';
  form.style.marginTop = '10px';
  form.style.display = 'flex';
  form.style.gap = '8px';
  form.innerHTML = `
    <input type="text" placeholder="Enter ${type}..." required style="flex:2; padding:2px 6px;" />
    <input type="date" style="flex:1; padding:2px 6px;" />
    <div class="button-row">
      <button type="submit">Add</button>
      <button type="button" class="cancel-btn">Cancel</button>
    </div>
  `;
  depContainer.appendChild(form);

  const [textInput, dateInput, addBtn, cancelBtn] = form.elements;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    const deadline = dateInput.value;
    if (!text) return;
    const updated = await loadDecisions();
    updated.push({
      id: generateId(),
      type,
      text,
      parentGoalId: item.id,
      deadline: deadline || '',
      dependencies: [],
      completed: false,
      resolution: '',
      dateCompleted: ''
    });
    await saveDecisions(updated);
    renderGoalsAndSubitems();
  };

  cancelBtn.onclick = () => form.remove();
}

addDecisionBtn.onclick = () => showInlineForm('decision');
addTaskBtn.onclick = () => showInlineForm('task');

