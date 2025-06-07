// js/render.js
import { loadDecisions, saveDecisions, saveGoalOrder, generateId } from './decisionModel.js';
import { formatDaysUntil } from './helpers.js';

const goalList = document.getElementById('goalList');
const completedList = document.getElementById('completedList');

let dragSrcEl = null;

export async function renderGoalsAndSubitems() {
    goalList.innerHTML = '';
    completedList.innerHTML = '';

    let hiddenSection = document.getElementById('hiddenList');
    if (!hiddenSection) {
        hiddenSection = document.createElement('div');
        hiddenSection.id = 'hiddenList';
        hiddenSection.innerHTML = `<h2 style="margin-top: 32px;">Hidden Goals</h2>`;
        // Insert just above the completedList
        goalList.parentNode.insertBefore(hiddenSection, completedList);
    } else {
        hiddenSection.innerHTML = `<h2 style="margin-top: 32px;">Hidden Goals</h2>`;
    }


    const all = await loadDecisions();
    const goals = all.filter(i => i.type === 'goal');
    const goalMap = Object.fromEntries(goals.map(g => [g.id, g]));

    const snap = await db.collection('decisions').doc(firebase.auth().currentUser.uid).get();
    const goalOrder = Array.isArray(snap.data()?.goalOrder)
        ? snap.data().goalOrder
        : goals.map(g => g.id);

    const sortedGoals = goalOrder.map(id => goalMap[id]).filter(Boolean);

    const now = Date.now();

    sortedGoals.forEach(goal => {
        const hideUntil = goal.hiddenUntil ? new Date(goal.hiddenUntil).getTime() : 0;

        const wrapper = document.createElement('div');
        wrapper.className = 'decision goal-card';
        wrapper.setAttribute('draggable', 'true');
        wrapper.dataset.goalId = goal.id;

        const row = createGoalRow(goal);
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'goal-children';
        childrenContainer.style.display = 'none';

        const toggleBtn = row.querySelector('.toggle-triangle');
        toggleBtn.onclick = () => {
            const isVisible = childrenContainer.style.display === 'block';
            toggleBtn.textContent = isVisible ? '▶' : '▼';
            childrenContainer.style.display = isVisible ? 'none' : 'block';

            // Disable drag when expanded
            wrapper.setAttribute('draggable', isVisible ? 'true' : 'false');
        };


        wrapper.appendChild(row);
        wrapper.appendChild(childrenContainer);
        renderChildren(goal, all, childrenContainer);
        enableDragAndDrop(wrapper);

        if (goal.completed) {
            completedList.appendChild(wrapper);
        } else if (hideUntil && now < hideUntil) {
            const label = document.createElement('div');
            label.className = 'right-aligned';
            label.textContent = `Hidden until: ${new Date(hideUntil).toLocaleString()}`;
            wrapper.appendChild(label);
            hiddenSection.appendChild(wrapper); // FIXED — correctly places hidden goals
        } else {
            goalList.appendChild(wrapper);
        }
    });
}


function createGoalRow(goal, options = {}) {

    const row = document.createElement('div');
    row.className = 'decision-row';

    const left = document.createElement('div');
    left.className = 'left-group';

const toggle = document.createElement('span');
toggle.className = 'toggle-triangle';
toggle.style.marginRight = '6px';

if (!options.hideArrow) {
  toggle.textContent = '▶';
  toggle.style.cursor = 'pointer';
}


    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = goal.completed;
    checkbox.disabled = goal.completed;

    left.appendChild(toggle);
    left.appendChild(checkbox);

    checkbox.onchange = async () => {
        const resolution = prompt(`Mark goal complete: ${goal.text}`);
        if (!resolution) {
            checkbox.checked = false;
            return;
        }
        goal.completed = true;
        goal.resolution = resolution;
        const today = new Date();
        goal.dateCompleted = today.toISOString().split('T')[0];

        const updated = await loadDecisions();
        const idx = updated.findIndex(d => d.id === goal.id);
        if (idx !== -1) {
            updated[idx] = goal;
            await saveDecisions(updated);
        }

        renderGoalsAndSubitems();
    };

    const middle = document.createElement('div');
    middle.className = 'middle-group';
    middle.textContent = goal.text;

    const right = document.createElement('div');
    right.className = 'right-group';

    const due = document.createElement('div');
    due.className = 'due-column';
    due.textContent = goal.completed ? goal.dateCompleted : '';

    const buttonWrap = document.createElement('div');
    buttonWrap.className = 'button-row';

    attachEditButtons(goal, buttonWrap);


    right.appendChild(due);
    right.appendChild(buttonWrap);

    row.appendChild(left);
    row.appendChild(middle);
    row.appendChild(right);

if (!options.hideArrow) {
  toggle.onclick = () => {
    const wrapper = row.closest('.goal-card');
    const container = wrapper?.querySelector('.goal-children');
    const isVisible = container?.style.display === 'block';
    toggle.textContent = isVisible ? '▶' : '▼';
    if (container) container.style.display = isVisible ? 'none' : 'block';
  };
}


    return row;
}

function renderChildren(goal, all, container) {
  const children = all.filter(i => i.parentGoalId === goal.id);
  const now = Date.now();
const activeTasks = children.filter(c => {
  const hideUntil = c.hiddenUntil ? new Date(c.hiddenUntil).getTime() : 0;
  return !c.completed && (!hideUntil || now >= hideUntil);
});

  const completedTasks = children.filter(c => c.completed);

  container.innerHTML = ''; // Clear previous

  // ACTIVE TASKS
  activeTasks.forEach(task => {
    const wrapper = document.createElement('div');
    wrapper.className = 'decision indent-1';
    wrapper.setAttribute('draggable', 'false');

    const row = createGoalRow(task, { hideArrow: true });
    row.style.background = '#f6fefe';
    row.style.borderLeft = '4px solid #8cd1cc';
    wrapper.appendChild(row);

    container.appendChild(wrapper);
  });

  // ADD TASK
  const addRow = document.createElement('div');
  addRow.className = 'inline-add-form';
  addRow.style.display = 'flex';
  addRow.style.alignItems = 'center';
  addRow.style.gap = '8px';
  addRow.style.margin = '6px 0 10px';
  addRow.style.paddingLeft = '28px'; // align with indent-1

  const inputText = document.createElement('input');
  inputText.placeholder = 'New task...';
  inputText.style.width = '500px';
  inputText.style.fontSize = '0.95em';
  inputText.style.padding = '6px 10px';
  inputText.style.height = '32px';
  inputText.style.border = '1px solid #ccc';
  inputText.style.borderRadius = '6px';

  const addBtn = document.createElement('button');
  addBtn.textContent = '+';
  addBtn.title = 'Add task';
  addBtn.style.height = '32px';
  addBtn.style.lineHeight = '32px';
  addBtn.style.padding = '0 12px';
  addBtn.style.margin = '0 0px 1px';
  addBtn.style.fontSize = '1em';
  addBtn.style.borderRadius = '6px';
  addBtn.style.display = 'inline-flex';
  addBtn.style.alignItems = 'center';
  addBtn.style.justifyContent = 'center';

  addBtn.onclick = async () => {
    const text = inputText.value.trim();
    if (!text) return alert('Please enter task text.');

    const newTask = {
      id: generateId(),
      text,
      completed: false,
      dateCompleted: '',
      resolution: '',
      parentGoalId: goal.id,
      type: 'task'
    };

    const updated = await loadDecisions();
    updated.push(newTask);
    await saveDecisions(updated);
    inputText.value = '';
    renderChildren(goal, updated, container);
  };

  addRow.appendChild(inputText);
  addRow.appendChild(addBtn);
  container.appendChild(addRow);

  // COMPLETED TASKS
  completedTasks.forEach(task => {
    const wrapper = document.createElement('div');
    wrapper.className = 'decision indent-1 completed-decision-inline';
    wrapper.setAttribute('draggable', 'false');

    const row = document.createElement('div');
    row.className = 'decision-row';
    row.style.padding = '4px 8px';
    row.style.fontSize = '0.85em';
    row.style.alignItems = 'center';

    const left = document.createElement('div');
    left.className = 'check-column';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.disabled = true;
    left.appendChild(checkbox);

    const middle = document.createElement('div');
    middle.className = 'middle-group';
    middle.style.display = 'grid';
    middle.style.gridTemplateColumns = 'minmax(200px, 1fr) minmax(180px, auto)';
    middle.style.columnGap = '16px';

    const taskText = document.createElement('div');
    taskText.textContent = task.text;
    taskText.className = 'title-column';

    const resolution = document.createElement('div');
    resolution.textContent = task.resolution ? `→ ${task.resolution}` : '';
    resolution.style.fontStyle = 'italic';
    resolution.style.color = '#666';
    resolution.style.fontSize = '0.85em';

    middle.appendChild(taskText);
    middle.appendChild(resolution);

    const right = document.createElement('div');
    right.className = 'right-group';
    right.style.gap = '4px';

    const due = document.createElement('div');
    due.className = 'due-column';
    due.textContent = task.dateCompleted || '';

    const buttonWrap = document.createElement('div');
    buttonWrap.className = 'button-row';
    attachTaskDeleteButton(task, row);

    right.appendChild(due);
    right.appendChild(buttonWrap);

    row.appendChild(left);
    row.appendChild(middle);
    row.appendChild(right);
    wrapper.appendChild(row);

    container.appendChild(wrapper);
  });
}



function createItemRow(item) {
    const row = document.createElement('div');
    row.className = 'decision-row';
    const dueText = item.dateCompleted || '';


    row.innerHTML = item.completed
        ? `
      <div class="check-column"><input type="checkbox" checked disabled /></div>
      <div class="title-column"><strong>${item.type}:</strong> ${item.text}</div>
      <div class="due-column">${item.dateCompleted || ''}</div>
    `
        : `
      <div class="check-column"><input type="checkbox" /></div>
      <div class="title-column">${item.text}</div>
      <div class="due-column">${dueText}</div>
    `;

    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!item.completed && checkbox) {
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

    return row;
}

function attachEditButtons(item, buttonWrap) {
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'edit-btn';
    buttonWrap.appendChild(editBtn);

    let editing = false;

    editBtn.onclick = async () => {
        const row = editBtn.closest('.decision-row');
        const middle = row?.querySelector('.middle-group');
        const due = row?.querySelector('.due-column');

        if (!middle || !due) return;

        if (!editing) {
            editing = true;
            editBtn.textContent = 'Save';

            const textInput = document.createElement('input');
            textInput.value = item.text;
            textInput.style.width = '100%';

            const deadlineInput = document.createElement('input');
            deadlineInput.type = 'date';
            deadlineInput.value = item.deadline || '';
            deadlineInput.style.width = '140px';

            middle.innerHTML = '';
            middle.appendChild(textInput);

            due.innerHTML = '';
            due.appendChild(deadlineInput);
        } else {
            const text = middle.querySelector('input')?.value.trim();
            const deadline = due.querySelector('input')?.value.trim();

            const updated = await loadDecisions();
            const idx = updated.findIndex(d => d.id === item.id);
            if (idx !== -1) {
                updated[idx].text = text;
                updated[idx].deadline = deadline;
                await saveDecisions(updated);
            }

            editing = false;
            renderGoalsAndSubitems();
        }
    };

    const hideBtn = document.createElement('button');
    hideBtn.textContent = 'Hide ⏷';
    hideBtn.className = 'edit-btn';
    buttonWrap.appendChild(hideBtn);

    const dropdown = document.createElement('div');
    dropdown.style.position = 'absolute';
    dropdown.style.background = '#fff';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '6px';
    dropdown.style.padding = '4px 0';
    dropdown.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
    dropdown.style.zIndex = '9999';
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);

    const options = [
        { label: '1 hour', ms: 1 * 60 * 60 * 1000 },
        { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
        { label: '1 day', ms: 24 * 60 * 60 * 1000 },
        { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 }
    ];

    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.textContent = opt.label;
        optionDiv.style.padding = '6px 12px';
        optionDiv.style.cursor = 'pointer';
        optionDiv.onmouseover = () => optionDiv.style.background = '#f0f0f0';
        optionDiv.onmouseout = () => optionDiv.style.background = '#fff';

        optionDiv.onclick = async () => {
            const expiration = Date.now() + opt.ms;
            const updated = await loadDecisions();
            const idx = updated.findIndex(d => d.id === item.id);
            if (idx !== -1) {
                updated[idx].hiddenUntil = new Date(expiration).toISOString();
                await saveDecisions(updated);
            }

            dropdown.style.display = 'none';

            const card = hideBtn.closest('.goal-card');
            if (card) {
                card.style.transition = 'opacity 0.3s';
                card.style.opacity = '0';
                setTimeout(() => card.remove(), 300);
            }
        };

        dropdown.appendChild(optionDiv);
    });

    hideBtn.onclick = (e) => {
        e.stopPropagation();
        const rect = hideBtn.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    };

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== hideBtn) {
            dropdown.style.display = 'none';
        }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.className = 'remove-btn';
    deleteBtn.title = 'Delete goal';
    deleteBtn.style.fontSize = '0.9em';
    deleteBtn.style.padding = '6px 10px';
    buttonWrap.appendChild(deleteBtn);

    deleteBtn.onclick = async () => {
        if (!confirm(`Delete "${item.text}"?`)) return;
        const updated = await loadDecisions();
        const filtered = updated.filter(d => d.id !== item.id);
        await saveDecisions(filtered);

        const card = deleteBtn.closest('.goal-card');
        if (card) {
            card.style.transition = 'opacity 0.3s';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
        }
    };
}


function attachItemEditButton(item, row) {
    const cell = document.createElement('div');
    cell.className = 'edit-column';

    const btn = document.createElement('button');
    btn.textContent = 'Edit';
    btn.className = 'edit-btn';
    cell.appendChild(btn);
    row.appendChild(cell);

    let editing = false;

    btn.onclick = async () => {
        if (!editing) {
            editing = true;
            btn.textContent = 'Save';

            const textCell = row.querySelector('.title-column');
            const dueCell = row.querySelector('.due-column');

            const textInput = document.createElement('input');
            textInput.value = item.text;
            textInput.style.width = '100%';

            const deadlineInput = document.createElement('input');
            deadlineInput.type = 'date';
            deadlineInput.value = item.deadline || '';
            deadlineInput.style.width = '120px';

            textCell.innerHTML = '';
            textCell.appendChild(textInput);

            dueCell.innerHTML = '';
            dueCell.appendChild(deadlineInput);
        } else {
            const text = row.querySelector('.title-column input').value.trim();
            const deadline = row.querySelector('.due-column input').value.trim();

            const updated = await loadDecisions();
            const idx = updated.findIndex(d => d.id === item.id);
            if (idx !== -1) {
                updated[idx].text = text;
                updated[idx].deadline = deadline;
                await saveDecisions(updated);
            }

            editing = false;
            renderGoalsAndSubitems();
        }
    };
}

function attachTaskDeleteButton(item, row) {
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'remove-btn';
    deleteBtn.style.marginLeft = '8px';
    deleteBtn.onclick = async () => {
        if (!confirm(`Delete task: "${item.text}"?`)) return;
        const updated = await loadDecisions();
        const filtered = updated.filter(d => d.id !== item.id);
        await saveDecisions(filtered);
        renderGoalsAndSubitems();
    };
}

function enableDragAndDrop(wrapper) {
    const goalList = document.getElementById('goalList');

    wrapper.addEventListener('dragstart', e => {
        dragSrcEl = wrapper;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', wrapper.dataset.goalId);
        wrapper.classList.add('dragging');
    });

    wrapper.addEventListener('dragover', e => {
        e.preventDefault();
        wrapper.classList.add('goal-drop-indicator');
        e.dataTransfer.dropEffect = 'move';
    });

    wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('goal-drop-indicator');
    });

    wrapper.addEventListener('drop', async e => {
        e.preventDefault();
        wrapper.classList.remove('goal-drop-indicator');
        if (dragSrcEl && dragSrcEl !== wrapper) {
            const draggedId = dragSrcEl.dataset.goalId;
            const dropTargetId = wrapper.dataset.goalId;

            const siblings = [...goalList.children];
            const draggedIndex = siblings.findIndex(el => el.dataset.goalId === draggedId);
            const dropIndex = siblings.findIndex(el => el.dataset.goalId === dropTargetId);

            if (draggedIndex > -1 && dropIndex > -1) {
                goalList.insertBefore(dragSrcEl, draggedIndex < dropIndex ? wrapper.nextSibling : wrapper);
            }

            const newOrder = [...goalList.children]
                .map(el => el.dataset.goalId)
                .filter(Boolean);

            await saveGoalOrder(newOrder);
        }
        dragSrcEl = null;
    });

    wrapper.addEventListener('dragend', () => {
        wrapper.classList.remove('dragging');
    });
}
