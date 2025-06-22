import { loadDecisions, saveDecisions, saveGoalOrder, generateId, formatDaysUntil } from './helpers.js';
import { db } from './auth.js';

const openGoalIds = new Set();
const goalList = document.getElementById('goalList');
const completedList = document.getElementById('completedList');
let dragSrcEl = null;

['dragover', 'drop', 'dragenter', 'dragstart'].forEach(event => {
    document.addEventListener(event, e => {
        if (!e.target.closest('.decision') && !e.target.closest('.goal-card')) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
});

document.addEventListener('dragover', e => {
    if (
        !e.target.closest('.decision') &&
        !e.target.closest('.goal-card') &&
        !e.target.closest('.daily-task-wrapper')
    ) {
        e.preventDefault();
    }
});
document.addEventListener('drop', e => {
    if (
        !e.target.closest('.decision') &&
        !e.target.closest('.goal-card') &&
        !e.target.closest('.daily-task-wrapper')
    ) {
        e.preventDefault();
    }
});

function enableTaskDrag(wrapper, task, goal, all, container) {
    wrapper.addEventListener('dragstart', e => {
        if (e.target.closest('[data-task-id]') !== wrapper) {
            e.preventDefault(); // Only allow dragging the wrapper itself
            return;
        }
        draggedId = task.id;
        e.dataTransfer.setData('text/plain', draggedId);
        wrapper.classList.add('dragging');
    });

    wrapper.addEventListener('dragend', () => {
        draggedId = null;
        wrapper.classList.remove('dragging');
    });

    wrapper.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = e.dataTransfer.getData('text/plain');
        if (dragging && dragging !== task.id) {
            wrapper.classList.add('drag-over');
        }
    });

    wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('drag-over');
    });

    wrapper.addEventListener('drop', async e => {
        e.preventDefault();
        wrapper.classList.remove('drag-over');

        const droppedId = e.dataTransfer.getData('text/plain');
        if (!droppedId || droppedId === task.id) return;

        const updated = await loadDecisions();

        const underGoal = updated.filter(i => i.parentGoalId === goal.id && !i.completed);
        const others = updated.filter(i => i.parentGoalId !== goal.id || i.completed);

        const fromIdx = underGoal.findIndex(i => i.id === droppedId);
        const toIdx = underGoal.findIndex(i => i.id === task.id);

        if (fromIdx === -1 || toIdx === -1) return;

        const [moved] = underGoal.splice(fromIdx, 1);
        underGoal.splice(toIdx, 0, moved);

        const reordered = [...others, ...underGoal];
        await saveDecisions(reordered);
        renderGoalsAndSubitems();
    });
}

// Reusable icon‐style button factory (same as in dailyTasks)
function makeIconBtn(symbol, title, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = symbol;
    b.title = title;
    Object.assign(b.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.1em',
        padding: '0'
    });
    // Prevent clicks from bubbling up (and interfering with drag)
    b.addEventListener('mousedown', e => e.stopPropagation());
    b.addEventListener('click', e => e.stopPropagation());
    b.onclick = fn;
    return b;
}

// File: render.js

/**
 * Attach ↑, ✏️, 🕒, ❌ buttons to a task-row.
 *
 * @param {{id:string,parentGoalId:string,text:string,completed:boolean,deadline?:string,hiddenUntil?:string}} item
 * @param {HTMLElement} row    the .decision-row for this task
 * @param {HTMLElement} listContainer  the parent .task-list element
 */
export async function attachTaskButtons(item, row, listContainer) {
  const buttonWrap = row.querySelector('.button-row');
  if (!buttonWrap) return;

  // — Move Up button —
  const upBtn = makeIconBtn('⬆️', 'Move task up', async () => {
    const wrapper = row.closest('[data-task-id]');
    const prev = wrapper.previousElementSibling;
    if (prev && prev.dataset.taskId) {
      listContainer.insertBefore(wrapper, prev);
      // Persist new order
      const ids = Array.from(listContainer.children).map(w => w.dataset.taskId);
      const all = await loadDecisions();
      const under = all.filter(d => d.parentGoalId === item.parentGoalId && !d.completed);
      const other = all.filter(d => d.parentGoalId !== item.parentGoalId || d.completed);
      const reordered = ids.map(id => under.find(t => t.id === id)).filter(Boolean);
      await saveDecisions([...other, ...reordered]);
    }
  });

  // — Edit button —
  const editBtn = makeIconBtn('✏️', 'Edit task', async () => {
    const newText = prompt('Edit task:', item.text)?.trim();
    if (newText && newText !== item.text) {
      const all = await loadDecisions();
      const idx = all.findIndex(d => d.id === item.id);
      all[idx].text = newText;
      await saveDecisions(all);
      row.querySelector('.middle-group').textContent = newText;
    }
  });

  // — Temporarily hide (postpone) button & dropdown —
  const clockBtn = makeIconBtn('🕒', 'Temporarily hide', () => {/* click is handled below */});

  // build the hide-duration menu
  const menu = document.createElement('div');
  Object.assign(menu.style, {
    position: 'absolute',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: '6px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    padding: '6px 0',
    fontSize: '0.9em',
    display: 'none',
    zIndex: '9999',
    minWidth: '120px'
  });
  document.body.appendChild(menu);

  const options = [
    { label: '1 hour',  value: 1 },
    { label: '2 hours', value: 2 },
    { label: '4 hours', value: 4 },
    { label: '8 hours', value: 8 },
    { label: '1 day',   value: 24 },
    { label: '4 days',  value: 96 },
    { label: '1 week',  value: 168 },
    { label: '1 month', value: 720 }
  ];

  options.forEach(opt => {
    const optBtn = document.createElement('button');
    optBtn.type = 'button';
    optBtn.textContent = opt.label;
    Object.assign(optBtn.style, {
      display: 'block',
      width: '100%',
      padding: '4px 12px',
      border: 'none',
      background: 'white',
      color: '#333',
      textAlign: 'left',
      cursor: 'pointer'
    });
    optBtn.addEventListener('mouseover', () => optBtn.style.background = '#f0f0f0');
    optBtn.addEventListener('mouseout',  () => optBtn.style.background = 'white');

    optBtn.addEventListener('click', async e => {
      e.stopPropagation();
      // load, set hiddenUntil, save
      const all = await loadDecisions();
      const idx = all.findIndex(d => d.id === item.id);
      if (idx === -1) return;

      const targetTime = new Date(Date.now() + opt.value * 3600 * 1000);
      // use ISO format so parsing is reliable
      all[idx].hiddenUntil = targetTime.toISOString();
      await saveDecisions(all);

      menu.style.display = 'none';
      // re-render everything so this task disappears until the time elapses
      renderGoalsAndSubitems();
    });

    menu.appendChild(optBtn);
  });

  clockBtn.addEventListener('click', e => {
    e.stopPropagation();
    const rect = clockBtn.getBoundingClientRect();
    menu.style.top  = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.left   + window.scrollX}px`;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && e.target !== clockBtn) {
      menu.style.display = 'none';
    }
  });

  // — Delete button —
  const delBtn = makeIconBtn('❌', 'Delete task', async () => {
    if (!confirm(`Delete task: "${item.text}"?`)) return;
    const all = await loadDecisions();
    await saveDecisions(all.filter(d => d.id !== item.id));
    row.closest('[data-task-id]').remove();
  });

  // append in the desired order
  buttonWrap.append(upBtn, editBtn, clockBtn, delBtn);
}

// File: src/render.js

// ─── Updated createGoalRow: only adds its own date‐picker when options.hideScheduled===false ───
function createGoalRow(goal, options = {}) {
  const row = document.createElement('div');
  row.className = 'decision-row';

  // left
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
  left.append(toggle, checkbox);
  row.appendChild(left);

  // middle
  const middle = document.createElement('div');
  middle.className = 'middle-group';
  middle.textContent = goal.text;
  row.appendChild(middle);

  // right
  const right = document.createElement('div');
  right.className = 'right-group';

  // only show built‐in date‐picker when hideScheduled is false
  if (!options.hideScheduled) {
    const schedWrap = document.createElement('div');
    schedWrap.className = 'scheduled-column';
    const schedInput = document.createElement('input');
    schedInput.type = 'date';
    schedInput.value = goal.scheduled || '';
    schedInput.title = 'Scheduled';
    schedInput.onchange = async () => {
      const items = await loadDecisions();
      const idx   = items.findIndex(d => d.id === goal.id);
      if (idx !== -1) {
        items[idx].scheduled = schedInput.value || null;
        await saveDecisions(items);
        renderGoalsAndSubitems();
      }
    };
    schedWrap.appendChild(schedInput);
    right.appendChild(schedWrap);
  }

  // due/completed
  const due = document.createElement('div');
  due.className = 'due-column';
  due.textContent = goal.completed ? goal.dateCompleted : '';
  right.appendChild(due);

  // buttons
  const buttonWrap = document.createElement('div');
  buttonWrap.className = 'button-row';
  if (goal.type === 'goal') attachEditButtons(goal, buttonWrap);
  right.appendChild(buttonWrap);

  row.appendChild(right);
  return row;
}


// File: src/render.js

export async function renderGoalsAndSubitems() {
  // 1) Clear existing
  goalList.innerHTML = '';
  completedList.innerHTML = '';

  const renderedGoalIds = new Set();
  const all = await loadDecisions();
  console.log('🔍 Total items loaded:', all);

  // 2) Sync goalOrder
  const goals = all.filter(i => i.type === 'goal' && !i.parentGoalId);
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]));
  const snap = await db.collection('decisions')
    .doc(firebase.auth().currentUser.uid)
    .get();
  let goalOrder = Array.isArray(snap.data()?.goalOrder)
    ? snap.data().goalOrder
    : [];
  const missing = goals.map(g => g.id).filter(id => !goalOrder.includes(id));
  if (missing.length) {
    goalOrder = [...goalOrder, ...missing];
    await saveGoalOrder(goalOrder);
  }
  const sortedGoals = goalOrder.map(id => goalMap[id]).filter(Boolean);
  const now = Date.now();

  // 3) Hidden Goals
  let hiddenSection = document.getElementById('hiddenList');
  if (!hiddenSection) {
    hiddenSection = document.createElement('div');
    hiddenSection.id = 'hiddenList';
    hiddenSection.innerHTML = `
      <h2 style="margin-top:32px">
        <span id="toggleHidden" style="cursor:pointer">▶</span> Hidden Goals
      </h2>
      <div id="hiddenContent" style="display:none"></div>
    `;
    goalList.parentNode.insertBefore(hiddenSection, goalList.nextSibling);
    const toggleHidden = hiddenSection.querySelector('#toggleHidden');
    const hiddenContent = hiddenSection.querySelector('#hiddenContent');
    toggleHidden.onclick = () => {
      const open = hiddenContent.style.display === 'block';
      toggleHidden.textContent = open ? '▶' : '▼';
      hiddenContent.style.display = open ? 'none' : 'block';
    };
  }
  const hiddenContent = hiddenSection.querySelector('#hiddenContent');
  hiddenContent.innerHTML = '';

  // 4) Calendar section
  let calendarSection = document.getElementById('calendarSection');
  if (!calendarSection) {
    calendarSection = document.createElement('div');
    calendarSection.id = 'calendarSection';
    calendarSection.innerHTML = `
      <h2>
        <span style="visibility:hidden">▶</span> Calendar
      </h2>
      <div id="calendarContent"></div>
    `;
    const parent = goalList.parentNode;
    const completedSec = document.getElementById('completedSection');
    parent.insertBefore(calendarSection, completedSec || hiddenSection.nextSibling);
  }
  const calendarContent = calendarSection.querySelector('#calendarContent');
  calendarContent.innerHTML = '';

  // 5) Completed Goals
  let completedSection = document.getElementById('completedSection');
  if (!completedSection) {
    completedSection = document.createElement('div');
    completedSection.id = 'completedSection';
    const hdr = document.createElement('h2');
    const toggle = document.createElement('span');
    toggle.textContent = '▶';
    toggle.style.cursor = 'pointer';
    hdr.appendChild(toggle);
    hdr.append(' Completed');
    const completedContent = document.createElement('div');
    completedContent.id = 'completedContent';
    completedContent.style.display = 'none';
    completedContent.appendChild(completedList);
    toggle.onclick = () => {
      const open = completedContent.style.display === 'block';
      toggle.textContent = open ? '▶' : '▼';
      completedContent.style.display = open ? 'none' : 'block';
    };
    completedSection.appendChild(hdr);
    completedSection.appendChild(completedContent);
    goalList.parentNode.appendChild(completedSection);
  }

  // 6) Split scheduled vs non-scheduled
  const scheduledGoals = sortedGoals
    .filter(g => !g.completed && typeof g.scheduled === 'string')
    .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled));
  const nonScheduled = sortedGoals.filter(g => !g.scheduled);

  // 7) Within nonScheduled: completed vs hidden/active
  const completedGoals = nonScheduled
    .filter(g => g.completed && g.dateCompleted)
    .sort((a, b) => new Date(b.dateCompleted) - new Date(a.dateCompleted));
  const hiddenAndActive = nonScheduled
    .filter(g => !g.completed)
    .sort((a, b) => {
      const ta = a.hiddenUntil ? Date.parse(a.hiddenUntil) || 0 : 0;
      const tb = b.hiddenUntil ? Date.parse(b.hiddenUntil) || 0 : 0;
      return ta - tb;
    });

  // 8) Render scheduled goals (static date + input only on Edit)
  console.log('📅 scheduledGoals:', scheduledGoals);
  scheduledGoals.forEach(goal => {
    const hideUntil = goal.hiddenUntil ? Date.parse(goal.hiddenUntil) || 0 : 0;
    const isHidden = hideUntil && now < hideUntil;

    const wrapper = document.createElement('div');
    wrapper.className = 'decision goal-card';
    wrapper.dataset.goalId = goal.id;
    wrapper.setAttribute('draggable', 'true');

    // build row without its own picker
    const row = createGoalRow(goal, { hideScheduled: true });
    const buttonWrap = row.querySelector('.button-row');
    const editBtn = buttonWrap.querySelector('button[title="Edit"]');

    // static date label
    const dateSpan = document.createElement('span');
    dateSpan.className   = 'goal-date';
    dateSpan.textContent = goal.scheduled;
    buttonWrap.insertBefore(dateSpan, editBtn);

    // hidden date-input
    const dateInput = document.createElement('input');
    dateInput.type        = 'date';
    dateInput.value       = goal.scheduled;
    dateInput.style.display = 'none';
    dateInput.onchange    = async () => {
      const items = await loadDecisions();
      const idx   = items.findIndex(d => d.id === goal.id);
      if (idx !== -1) {
        items[idx].scheduled = dateInput.value || null;
        await saveDecisions(items);
        renderGoalsAndSubitems();
      }
    };
    buttonWrap.insertBefore(dateInput, editBtn);

    // reveal on Edit
    editBtn.addEventListener('click', () => {
      dateInput.style.display = 'inline-block';
    });

    wrapper.appendChild(row);

    // children container + render its tasks
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'goal-children';
    childrenContainer.style.display = openGoalIds.has(goal.id) ? 'block' : 'none';
    wrapper.appendChild(childrenContainer);
    renderChildren(goal, all, childrenContainer);

    // toggle caret
    const toggle = row.querySelector('.toggle-triangle');
    toggle.onclick = () => {
      const open = childrenContainer.style.display === 'block';
      toggle.textContent = open ? '▶' : '▼';
      childrenContainer.style.display = open ? 'none' : 'block';
      wrapper.setAttribute('draggable', open ? 'true' : 'false');
      if (open) openGoalIds.delete(goal.id);
      else       openGoalIds.add(goal.id);
    };

    // append or hide
    if (isHidden) {
      const btn = document.createElement('button');
      btn.textContent = 'Unhide';
      btn.onclick   = async () => {
        const items = await loadDecisions();
        const i = items.findIndex(d => d.id === goal.id);
        if (i !== -1) {
          items[i].hiddenUntil = null;
          await saveDecisions(items);
          renderGoalsAndSubitems();
        }
      };
      const lbl = document.createElement('div');
      lbl.className   = 'right-aligned';
      lbl.textContent = `Hidden until: ${new Date(hideUntil).toLocaleString()}`;
      lbl.appendChild(btn);
      wrapper.appendChild(lbl);
      hiddenContent.appendChild(wrapper);
    } else {
      calendarContent.appendChild(wrapper);
      enableDragAndDrop(wrapper, 'goal');
    }

    renderedGoalIds.add(goal.id);
  });

  // 9) Render remaining non-scheduled goals
  const finalList = [...completedGoals, ...hiddenAndActive];
  finalList.forEach(goal => {
    if (renderedGoalIds.has(goal.id)) return;

    const hideUntil = goal.hiddenUntil ? Date.parse(goal.hiddenUntil) || 0 : 0;
    const isCompleted = !!goal.completed;
    const isHidden    = hideUntil && now < hideUntil;

    const wrapper = document.createElement('div');
    wrapper.className = 'decision goal-card';
    wrapper.dataset.goalId = goal.id;
    wrapper.setAttribute('draggable', 'true');

    const row = createGoalRow(goal, { hideScheduled: true });
    wrapper.appendChild(row);

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'goal-children';
    childrenContainer.style.display = openGoalIds.has(goal.id) ? 'block' : 'none';
    wrapper.appendChild(childrenContainer);
    renderChildren(goal, all, childrenContainer);

    const toggleBtn = row.querySelector('.toggle-triangle');
    toggleBtn.onclick = () => {
      const open = childrenContainer.style.display === 'block';
      toggleBtn.textContent = open ? '▶' : '▼';
      childrenContainer.style.display = open ? 'none' : 'block';
      wrapper.setAttribute('draggable', open ? 'true' : 'false');
      if (open) openGoalIds.delete(goal.id);
      else       openGoalIds.add(goal.id);
    };

    if (isCompleted) {
      completedList.appendChild(wrapper);
    } else if (isHidden) {
      const btn = document.createElement('button');
      btn.textContent = 'Unhide';
      btn.onclick   = async () => {
        const items = await loadDecisions();
        const idx = items.findIndex(d => d.id === goal.id);
        if (idx !== -1) {
          items[idx].hiddenUntil = null;
          await saveDecisions(items);
          renderGoalsAndSubitems();
        }
      };
      const lbl = document.createElement('div');
      lbl.className   = 'right-aligned';
      lbl.textContent = `Hidden until: ${new Date(hideUntil).toLocaleString()}`;
      lbl.appendChild(btn);
      wrapper.appendChild(lbl);
      hiddenContent.appendChild(wrapper);
    } else {
      goalList.appendChild(wrapper);
    }

    renderedGoalIds.add(goal.id);
  });
}




function attachEditButtons(item, buttonWrap) {
    // ✏️ Edit icon button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit';
    editBtn.style.background = 'none';
    editBtn.style.border = 'none';
    editBtn.style.cursor = 'pointer';
    editBtn.style.fontSize = '1.2em';
    buttonWrap.appendChild(editBtn);

    // 🕒 Hide select (only for incomplete goals)
    if (!item.completed) {
        const clockBtn = document.createElement('button');
        clockBtn.type = 'button';
        clockBtn.innerHTML = '🕒';
        clockBtn.title = 'Temporarily hide';
        clockBtn.style.background = 'none';
        clockBtn.style.border = 'none';
        clockBtn.style.cursor = 'pointer';
        clockBtn.style.fontSize = '1.2em';
        buttonWrap.appendChild(clockBtn);

        // build the hide-duration menu
        const menu = document.createElement('div');
        Object.assign(menu.style, {
            position: 'absolute',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            padding: '6px 0',
            fontSize: '0.9em',
            display: 'none',
            zIndex: '9999',
            minWidth: '120px'
        });
        document.body.appendChild(menu);

        const options = [
            { label: '1 hour', value: 1 },
            { label: '2 hours', value: 2 },
            { label: '4 hours', value: 4 },
            { label: '8 hours', value: 8 },
            { label: '1 day', value: 24 },
            { label: '4 days', value: 96 },
            { label: '1 week', value: 168 },
            { label: '1 month', value: 720 }
        ];

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = opt.label;
            Object.assign(btn.style, {
                display: 'block',
                width: '100%',
                padding: '4px 12px',
                border: 'none',
                background: 'white',
                color: '#333',
                textAlign: 'left',
                cursor: 'pointer'
            });
            btn.addEventListener('mouseover', () => btn.style.background = '#f0f0f0');
            btn.addEventListener('mouseout', () => btn.style.background = 'white');

            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const all = await loadDecisions();
                const idx = all.findIndex(d => d.id === item.id);
                if (idx === -1) return;

                // set hiddenUntil and save
                const targetTime = new Date(Date.now() + opt.value * 3600 * 1000);
                all[idx].hiddenUntil = targetTime.toLocaleString('en-CA', { hour12: false });
                await saveDecisions(all);

                menu.style.display = 'none';
                renderGoalsAndSubitems();
            });

            menu.appendChild(btn);
        });

        clockBtn.addEventListener('click', e => {
            e.stopPropagation();
            const rect = clockBtn.getBoundingClientRect();
            menu.style.top = `${rect.bottom + window.scrollY}px`;
            menu.style.left = `${rect.left + window.scrollX}px`;
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', e => {
            if (!menu.contains(e.target) && e.target !== clockBtn) {
                menu.style.display = 'none';
            }
        });
    }

    // ❌ Delete icon button for goals
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '❌';
    deleteBtn.title = 'Delete';
    deleteBtn.style.background = 'none';
    deleteBtn.style.border = 'none';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontSize = '1.2em';
    buttonWrap.appendChild(deleteBtn);

    // Prevent clicks from interfering with drag
    [editBtn, deleteBtn].forEach(btn => {
        btn.addEventListener('mousedown', e => e.stopPropagation());
        btn.addEventListener('click', e => e.stopPropagation());
    });

    deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete goal: "${item.text}"?`)) return;
        const all = await loadDecisions();
        const filtered = all.filter(d => d.id !== item.id && d.parentGoalId !== item.id);
        await saveDecisions(filtered);
        renderGoalsAndSubitems();
    });

    // ——————— “Edit” → “Save” in-place ———————
    let editing = false;
    editBtn.addEventListener('click', async () => {
        const row = editBtn.closest('.decision-row');
        const middle = row.querySelector('.middle-group');
        const due = row.querySelector('.due-column');
        if (!middle || !due) return;

        if (!editing) {
            editing = true;
            editBtn.innerHTML = '💾';

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
            editing = false;
            const newText = middle.querySelector('input')?.value.trim();
            const newDeadline = due.querySelector('input')?.value.trim();

            const all = await loadDecisions();
            const idx = all.findIndex(d => d.id === item.id);
            if (idx !== -1) {
                all[idx].text = newText;
                all[idx].deadline = newDeadline;
                await saveDecisions(all);

                middle.textContent = newText;
                due.textContent = newDeadline;
                editBtn.innerHTML = '✏️';
            }
        }
    });
}

// File: src/render.js




export function renderChildren(goal, all, container) {
    const children = all.filter(i => i.parentGoalId === goal.id);
    const now = Date.now();

    // Separate active vs completed tasks, respecting hiddenUntil
    const activeTasks = children.filter(c => {
        let hideUntil = 0;
        if (c.hiddenUntil) {
            hideUntil = typeof c.hiddenUntil === 'string'
                ? new Date(c.hiddenUntil).getTime()
                : c.hiddenUntil;
            if (isNaN(hideUntil)) hideUntil = 0;
        }
        return !c.completed && (!hideUntil || now >= hideUntil);
    });
    const completedTasks = children.filter(c => c.completed);

    // Clear existing children
    container.innerHTML = '';

    // --- Active tasks ---
    // --- Active tasks ---
    const taskList = document.createElement('div');
    taskList.className = 'task-list';
    container.appendChild(taskList);

    activeTasks.forEach(task => {
        // 1️⃣ Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'decision indent-1';
        wrapper.setAttribute('draggable', 'true');
        wrapper.dataset.taskId = task.id;

        // 2️⃣ Build the row
        const row = createGoalRow(task, { hideArrow: true });
        row.style.background = '#f6fefe';
        row.style.borderLeft = '4px solid #8cd1cc';

        // 3️⃣ Wire drag‐and‐drop
        enableTaskDragAndDrop(wrapper, taskList, goal.id);

        // 4️⃣ Attach the ↑ ✏️ 🕒 ❌ buttons
        //    (uses the same makeIconBtn factory from dailyTasks)
        attachTaskButtons(task, row, taskList);

        // 5️⃣ Assemble into DOM
        wrapper.appendChild(row);
        taskList.appendChild(wrapper);
    });


    // --- Add new task form ---
    const addRow = document.createElement('div');
    addRow.className = 'inline-add-form';
    addRow.setAttribute('role', 'presentation');
    Object.assign(addRow.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '6px 0 10px',
        paddingLeft: '28px'
    });

    const inputText = document.createElement('input');
    inputText.placeholder = 'New task…';
    Object.assign(inputText.style, {
        width: '500px',
        fontSize: '0.95em',
        padding: '6px 10px',
        height: '32px',
        border: '1px solid #ccc',
        borderRadius: '6px'
    });
    inputText.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBtn.click();
        }
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.title = 'Add task';
    Object.assign(addBtn.style, {
        height: '32px',
        lineHeight: '32px',
        padding: '0 12px',
        margin: '0 0 1px',
        fontSize: '1em',
        borderRadius: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
    });
    addBtn.addEventListener('click', async e => {
        e.preventDefault();
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
    });

    addRow.append(inputText, addBtn);
    container.appendChild(addRow);

    // --- Completed tasks ---
    if (completedTasks.length) {
        const doneContainer = document.createElement('div');
        doneContainer.className = 'completed-task-list';
        container.appendChild(doneContainer);

        completedTasks.forEach(task => {
            const wrapper = document.createElement('div');
            wrapper.className = 'decision indent-1 completed-decision-inline';
            wrapper.setAttribute('draggable', 'false');
            wrapper.dataset.taskId = task.id;

            const row = document.createElement('div');
            row.className = 'decision-row';
            Object.assign(row.style, {
                padding: '4px 8px',
                fontSize: '0.85em',
                alignItems: 'center'
            });

            // ✔️ checkbox
            const left = document.createElement('div');
            left.className = 'check-column';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.disabled = true;
            left.appendChild(checkbox);

            // middle: text + resolution
            const middle = document.createElement('div');
            middle.className = 'middle-group';
            Object.assign(middle.style, {
                display: 'grid',
                gridTemplateColumns: 'minmax(200px,1fr) minmax(180px,auto)',
                columnGap: '16px'
            });
            const taskText = document.createElement('div');
            taskText.className = 'title-column';
            taskText.textContent = task.text;
            const resolution = document.createElement('div');
            resolution.textContent = task.resolution ? `→ ${task.resolution}` : '';
            Object.assign(resolution.style, {
                fontStyle: 'italic',
                color: '#666',
                fontSize: '0.85em'
            });
            middle.append(taskText, resolution);

            // right: date + buttons
            const right = document.createElement('div');
            right.className = 'right-group';
            right.style.gap = '4px';
            const due = document.createElement('div');
            due.className = 'due-column';
            due.textContent = task.dateCompleted || '';
            const buttonWrap = document.createElement('div');
            buttonWrap.className = 'button-row';
            // wire delete/edit/postpone but skip move-up if you like
            attachTaskButtons(task, row);

            right.append(due, buttonWrap);

            row.append(left, middle, right);
            wrapper.appendChild(row);
            doneContainer.appendChild(wrapper);
        });
    }
}



function enableDragAndDrop(wrapper, type = 'goal') {
    const goalList = document.getElementById('goalList');

    wrapper.addEventListener('dragstart', e => {
        if (type === 'goal' && e.target.closest('[data-task-id]')) {
            // 💥 Don't allow goal drag when dragging a task
            e.stopPropagation();
            return;
        }

        dragSrcEl = wrapper;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', wrapper.dataset.goalId);
        wrapper.classList.add('dragging');
    });

    wrapper.addEventListener('dragover', e => {
        if (type === 'goal' && e.target.closest('[data-task-id]')) return;

        e.preventDefault();
        e.stopPropagation();
        if (type === 'goal') wrapper.classList.add('goal-drop-indicator');
    });

    wrapper.addEventListener('dragleave', () => {
        if (type === 'goal') wrapper.classList.remove('goal-drop-indicator');
    });

    wrapper.addEventListener('drop', async e => {
        if (type === 'goal' && e.target.closest('[data-task-id]')) return;

        e.preventDefault();
        e.stopPropagation();

        wrapper.classList.remove('goal-drop-indicator');

        if (dragSrcEl && dragSrcEl !== wrapper) {
            const draggedId = dragSrcEl.dataset.goalId;
            const dropTargetId = wrapper.dataset.goalId;

            if (!draggedId || !dropTargetId) return;

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

function enableTaskDragAndDrop(wrapper, taskList, goalId) {
    wrapper.addEventListener('dragstart', e => {
        e.stopPropagation();
        dragSrcEl = wrapper;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', wrapper.dataset.taskId);
        wrapper.classList.add('dragging');
        console.log('Dragging task:', wrapper.dataset.taskId);
    });

    wrapper.addEventListener('dragover', e => {
        e.preventDefault(); // 🔥 prevents page reload
        e.stopPropagation();
        wrapper.classList.add('drag-over');
    });

    wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('drag-over');
    });

    wrapper.addEventListener('drop', async e => {
        e.preventDefault(); // 🔥 prevents page reload
        e.stopPropagation();
        wrapper.classList.remove('drag-over');

        const droppedId = e.dataTransfer.getData('text/plain');
        const targetId = wrapper.dataset.taskId;

        if (!droppedId || droppedId === targetId) return;

        console.log(`Dropped task: ${droppedId} on ${targetId}`);

        const children = [...taskList.children].filter(el => el.dataset.taskId);
        const fromIdx = children.findIndex(el => el.dataset.taskId === droppedId);
        const toIdx = children.findIndex(el => el.dataset.taskId === targetId);

        if (fromIdx === -1 || toIdx === -1) return;

        const draggedEl = children[fromIdx];
        taskList.insertBefore(draggedEl, fromIdx < toIdx ? wrapper.nextSibling : wrapper);

        const newOrder = [...taskList.children]
            .map(el => el.dataset.taskId)
            .filter(Boolean);

        const updated = await loadDecisions();
        const underGoal = updated.filter(i => i.parentGoalId === goalId && !i.completed);
        const others = updated.filter(i => i.parentGoalId !== goalId || i.completed);

        const reordered = newOrder.map(id => underGoal.find(t => t.id === id)).filter(Boolean);

        await saveDecisions([...others, ...reordered]);
        console.log('Saved new order for goal', goalId, newOrder);

        // Just update this goal's children
        const parentContainer = wrapper.closest('.goal-children');
        const parentGoal = updated.find(g => g.id === goalId);
        if (parentContainer && parentGoal) {
            renderChildren(parentGoal, updated, parentContainer);
        }

    });

    wrapper.addEventListener('dragend', () => {
        wrapper.classList.remove('dragging');
    });
}




