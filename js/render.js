// js/render.js
import { loadDecisions, saveDecisions, saveGoalOrder, generateId } from './decisionModel.js';
import { formatDaysUntil } from './helpers.js';

const goalList = document.getElementById('goalList');
const completedList = document.getElementById('completedList');
let dragSrcEl = null;
export async function renderGoalsAndSubitems() {
  goalList.innerHTML = '';
  completedList.innerHTML = '';

  const all = await loadDecisions();

  const goals = all.filter(i => i.type === 'goal');
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]));

  const snap = await db.collection('decisions').doc(firebase.auth().currentUser.uid).get();
  const goalOrder = Array.isArray(snap.data()?.goalOrder)
    ? snap.data().goalOrder
    : goals.map(g => g.id);

  const sortedGoals = goalOrder.map(id => goalMap[id]).filter(Boolean);

  // Load hidden goal expiration map from localStorage
  const now = Date.now();
  const hiddenRaw = localStorage.getItem('hiddenGoals');
console.log('loaded hiddenGoals from localStorage:', hiddenRaw);
const hiddenMap = hiddenRaw ? JSON.parse(hiddenRaw) : {};


  sortedGoals.forEach(goal => {
    const hideUntil = hiddenMap[goal.id];
    if (hideUntil && now < hideUntil) {
      console.log(`Goal "${goal.text}" hidden until ${new Date(hideUntil).toLocaleTimeString()}`);
      return; // Skip rendering
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'decision goal-card';
    wrapper.setAttribute('draggable', 'true');
    wrapper.dataset.goalId = goal.id;

    const row = createGoalRow(goal);

    // Add "Hide 4h" button
    const hideBtn = document.createElement('button');
    hideBtn.textContent = 'Hide 4h';
    hideBtn.className = 'hide-btn';
    hideBtn.onclick = () => {
      const expiration = Date.now() + 4 * 60 * 60 * 1000;
      hiddenMap[goal.id] = expiration;
      localStorage.setItem('hiddenGoals', JSON.stringify(hiddenMap));
      renderGoalsAndSubitems(); // Re-render
    };
    const arrowCell = row.querySelector('.arrow-column');
    if (arrowCell) arrowCell.appendChild(hideBtn);

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'goal-children';
    childrenContainer.style.display = 'none';

    const toggleBtn = row.querySelector('.toggle-triangle');
    toggleBtn.onclick = () => {
      const isVisible = childrenContainer.style.display === 'block';
      toggleBtn.textContent = isVisible ? '▶' : '▼';
      childrenContainer.style.display = isVisible ? 'none' : 'block';
    };

    wrapper.appendChild(row);
    wrapper.appendChild(childrenContainer);
    goalList.appendChild(wrapper);

    renderChildren(goal, all, childrenContainer);
    enableDragAndDrop(wrapper);
  });
}






function createGoalRow(goal) {
  const row = document.createElement('div');
  row.className = 'decision-row';

  // LEFT: toggle + checkbox
  const left = document.createElement('div');
  left.className = 'left-group';

  const toggle = document.createElement('span');
  toggle.className = 'toggle-triangle';
  toggle.textContent = '▶';
  toggle.style.cursor = 'pointer';
  toggle.style.marginRight = '6px';

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
    goal.dateCompleted = new Date().toISOString().split('T')[0];

    const updated = await loadDecisions();
    const idx = updated.findIndex(d => d.id === goal.id);
    if (idx !== -1) {
      updated[idx] = goal;
      await saveDecisions(updated);
    }

    renderGoalsAndSubitems();
  };

  // MIDDLE: goal text
  const middle = document.createElement('div');
  middle.className = 'middle-group';
  middle.textContent = goal.text;

  // RIGHT: due + buttons
  const right = document.createElement('div');
  right.className = 'right-group';

  const due = document.createElement('div');
  due.className = 'due-column';
  due.textContent = goal.completed
    ? goal.dateCompleted
    : formatDaysUntil(goal.deadline);

  const buttonWrap = document.createElement('div');
  buttonWrap.className = 'button-row';

  attachGoalEditButton(goal, buttonWrap);
  attachGoalHideButton(goal, buttonWrap);


  right.appendChild(due);
  right.appendChild(buttonWrap);

  // Combine all
  row.appendChild(left);
  row.appendChild(middle);
  row.appendChild(right);

  // Toggle logic
  toggle.onclick = () => {
    const wrapper = row.closest('.goal-card');
    const container = wrapper?.querySelector('.goal-children');
    const isVisible = container?.style.display === 'block';
    toggle.textContent = isVisible ? '▶' : '▼';
    if (container) container.style.display = isVisible ? 'none' : 'block';
  };

  return row;
}




function attachGoalHideButton(goal, row) {
  const hideBtn = document.createElement('button');
  hideBtn.textContent = 'Hide';
  hideBtn.className = 'edit-btn';
  hideBtn.style.marginLeft = '8px';

  hideBtn.onclick = () => {
    // Retrieve current hidden goals map from localStorage
    const hiddenRaw = localStorage.getItem('hiddenGoals');
    const hiddenMap = hiddenRaw ? JSON.parse(hiddenRaw) : {};

    // Set hide expiration 4 hours from now
    const expiration = Date.now() + 4 * 60 * 60 * 1000;
    hiddenMap[goal.id] = expiration;

    // Save to localStorage
    localStorage.setItem('hiddenGoals', JSON.stringify(hiddenMap));
    console.log('Saved hiddenGoals:', hiddenMap);

    // Re-render to apply hidden state
    renderGoalsAndSubitems();
  };

  const cell = row.querySelector('.edit-column') || document.createElement('div');
  cell.className = 'edit-column';
  cell.appendChild(hideBtn);
  if (!row.contains(cell)) row.appendChild(cell);
}




function renderChildren(goal, all, container) {
  const children = all.filter(i => i.parentGoalId === goal.id);
  children.forEach(child => {
    const wrapper = document.createElement('div');
    wrapper.className = `decision indent-1 ${child.completed ? 'completed-decision-inline' : ''}`;

    const row = createItemRow(child);
    wrapper.appendChild(row);
    container.appendChild(wrapper);

    if (child.type === 'decision' || child.type === 'task') {
      attachItemEditButton(child, row);
    }

    if (child.type === 'task') {
      attachTaskDeleteButton(child, row);
    }
  });
}

function createItemRow(item) {
  const row = document.createElement('div');
  row.className = 'decision-row';
  const dueText = formatDaysUntil(item.deadline);

  row.innerHTML = item.completed
    ? `
      <div class="check-column"><input type="checkbox" checked disabled /></div>
      <div class="title-column"><strong>${item.type}:</strong> ${item.text}</div>
      <div class="due-column">${item.dateCompleted || ''}</div>
      <div class="arrow-column">✔</div>
    `
    : `
      <div class="check-column"><input type="checkbox" /></div>
      <div class="title-column">${item.text}</div>
      <div class="due-column">${dueText}</div>
      <div class="arrow-column">▶</div>
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

function attachGoalEditButton(goal, row) {
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
      textInput.value = goal.text;
      textInput.style.width = '100%';

      const deadlineInput = document.createElement('input');
      deadlineInput.type = 'date';
      deadlineInput.value = goal.deadline || '';
      deadlineInput.style.width = '140px';

      textCell.innerHTML = '';
      textCell.appendChild(textInput);

      dueCell.innerHTML = '';
      dueCell.appendChild(deadlineInput);
    } else {
      const text = row.querySelector('.title-column input').value.trim();
      const deadline = row.querySelector('.due-column input').value.trim();

      const updated = await loadDecisions();
      const idx = updated.findIndex(d => d.id === goal.id);
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

  const arrowCell = row.querySelector('.arrow-column');
  if (arrowCell) {
    arrowCell.innerHTML = '';
    arrowCell.appendChild(deleteBtn);
  }
}

function enableDragAndDrop(wrapper) {
  const goalList = document.getElementById('goalList');

  wrapper.addEventListener('dragstart', e => {
    dragSrcEl = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', wrapper.dataset.goalId); // Required
    wrapper.classList.add('dragging');
  });

  wrapper.addEventListener('dragover', e => {
    e.preventDefault(); // Allow drop
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

