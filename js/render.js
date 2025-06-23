import {
    initializeGlobalDragHandlers,
    enableGoalDragAndDrop,
    enableTaskDragAndDrop
} from './dragAndDrop.js';    // ← not './dragDrop.js'
import { loadDecisions, saveDecisions, saveGoalOrder, generateId, formatDaysUntil } from './helpers.js';
import { db } from './auth.js';

const openGoalIds = new Set();
const goalList = document.getElementById('goalList');
const completedList = document.getElementById('completedList');
let dragSrcEl = null;

initializeGlobalDragHandlers();

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

/**
 * Attach ↑, ✏️, 🕒, ❌ buttons to a task-row.
 *
 * @param {{id:string,parentGoalId:string,text:string,completed:boolean,scheduled?:string,hiddenUntil?:string}} item
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
    const clockBtn = makeIconBtn('🕒', 'Postpone goal', () => { });
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
        { label: '1 day', value: 24 },
        { label: '2 days', value: 48 },
        { label: '1 week', value: 168 },
        { label: '2 weeks', value: 336 }
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
        optBtn.addEventListener('mouseenter', () => optBtn.style.background = '#f0f0f0');
        optBtn.addEventListener('mouseleave', () => optBtn.style.background = 'white');

        optBtn.addEventListener('click', async e => {
            e.stopPropagation();
            // 1) update hiddenUntil
            const all = await loadDecisions();
            const idx = all.findIndex(d => d.id === item.id);
            if (idx === -1) return;
            all[idx].hiddenUntil = new Date(Date.now() + opt.value * 3600 * 1000).toISOString();
            await saveDecisions(all);

            // 2) hide this goal card only
            menu.style.display = 'none';
            const goalCard = row.closest('.decision.goal-card');
            if (goalCard) goalCard.style.display = 'none';
        });

        menu.appendChild(optBtn);
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

    // append everything
    buttonWrap.append(clockBtn);


    // — Delete button —
    const delBtn = makeIconBtn('❌', 'Delete task', async () => {
        if (!confirm(`Delete task: "${item.text}"?`)) return;
        const all = await loadDecisions();
        await saveDecisions(all.filter(d => d.id !== item.id));
        row.closest('[data-task-id]').remove();
    });

    // append them
    buttonWrap.append(upBtn, editBtn, clockBtn, delBtn);
}

function createGoalRow(goal, options = {}) {
    const row = document.createElement('div');
    row.className = 'decision-row';

    // ── Left group: toggle + checkbox ──
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
    checkbox.checked = !!goal.completed;
    checkbox.disabled = !!goal.completed;

    // ── Completion handler (goals only) ──
    if (goal.type === 'goal') {
        checkbox.addEventListener('change', async () => {
            // mark completed and set date
            goal.completed = true;
            goal.dateCompleted = new Date().toISOString().split('T')[0];

            // persist the change
            const items = await loadDecisions();
            const idx = items.findIndex(d => d.id === goal.id);
            items[idx] = goal;
            await saveDecisions(items);

            // move _this_ goal card into the completed list without full reload
            const wrapper = checkbox.closest('.decision.goal-card');
            wrapper.remove();
            wrapper.querySelector('.due-column').textContent = goal.dateCompleted;
            completedList.appendChild(wrapper);
        });
    }

    left.append(toggle, checkbox);
    row.appendChild(left);

    // ── Middle group: text ──
    const middle = document.createElement('div');
    middle.className = 'middle-group';
    middle.textContent = goal.text;
    row.appendChild(middle);

    // ── Right group: scheduled + buttons ──
    const right = document.createElement('div');
    right.className = 'right-group';

    if (goal.type === 'goal' && !options.hideScheduled) {
        const schedWrap = document.createElement('div');
        schedWrap.className = 'scheduled-column';
        const schedInput = document.createElement('input');
        schedInput.type = 'date';
        schedInput.value = goal.scheduled || '';
        schedInput.title = 'Scheduled';
        schedInput.onchange = async () => {
            const items = await loadDecisions();
            const i = items.findIndex(d => d.id === goal.id);
            if (i !== -1) {
                items[i].scheduled = schedInput.value || null;
                await saveDecisions(items);
                renderGoalsAndSubitems();
            }
        };
        schedWrap.appendChild(schedInput);
        right.appendChild(schedWrap);
    }

    const due = document.createElement('div');
    due.className = 'due-column';
    due.textContent = goal.completed ? goal.dateCompleted : '';
    right.appendChild(due);

    const buttonWrap = document.createElement('div');
    buttonWrap.className = 'button-row';
    if (goal.type === 'goal') {
        attachEditButtons(goal, buttonWrap);
    }
    right.appendChild(buttonWrap);

    row.appendChild(right);
    return row;
}

export async function renderGoalsAndSubitems() {
    // 1) Clear existing DOM
    goalList.innerHTML = '';
    completedList.innerHTML = '';

    // track which have been rendered so they don’t duplicate
    const renderedGoalIds = new Set();

    // 2) Load all decisions and sync goalOrder
    const all = await loadDecisions();
    const goals = all.filter(i => i.type === 'goal' && !i.parentGoalId);
    const goalMap = Object.fromEntries(goals.map(g => [g.id, g]));
    const snap = await db.collection('decisions')
        .doc(firebase.auth().currentUser.uid)
        .get();
    let goalOrder = Array.isArray(snap.data()?.goalOrder) ? snap.data().goalOrder : [];
    const missing = goals.map(g => g.id).filter(id => !goalOrder.includes(id));
    if (missing.length) {
        goalOrder = [...goalOrder, ...missing];
        await saveGoalOrder(goalOrder);
    }
    const sortedGoals = goalOrder.map(id => goalMap[id]).filter(Boolean);
    const now = Date.now();

    // 3) Hidden Goals section (only once)
    let hiddenSection = document.getElementById('hiddenList');
    if (!hiddenSection) {
        hiddenSection = document.createElement('div');
        hiddenSection.id = 'hiddenList';
        hiddenSection.innerHTML = `
      <h2 style="margin-top:32px">
        <span id="toggleHidden" style="cursor:pointer">▶</span> Hidden Goals
      </h2>
      <div id="hiddenContent" style="display:none"></div>
      <hr style="margin: 40px 0;" />
    `;
        const container = goalList.parentNode;
        const completedSection = document.getElementById('completedSection');
        if (completedSection) container.insertBefore(hiddenSection, completedSection);
        else container.appendChild(hiddenSection);

        const toggleHidden = hiddenSection.querySelector('#toggleHidden');
        const hiddenContent = hiddenSection.querySelector('#hiddenContent');
        toggleHidden.onclick = () => {
            const open = hiddenContent.style.display === 'block';
            toggleHidden.textContent = open ? '▶' : '▼';
            hiddenContent.style.display = open ? 'none' : 'block';
        };
    }
    const hiddenContent = hiddenSection.querySelector('#hiddenContent');

    // 4) Calendar section & render all scheduled goals
    let calendarSection = document.getElementById('calendarSection');
    if (!calendarSection) {
        calendarSection = document.createElement('div');
        calendarSection.id = 'calendarSection';
        calendarSection.innerHTML = `
      <h2>Calendar</h2>
      <div id="calendarContent"></div>
      <hr style="margin: 40px 0;" />
    `;
        const metricsContainer = document.getElementById('statsSection');
        const insertBeforeEl = metricsContainer || hiddenSection;
        insertBeforeEl.parentNode.insertBefore(calendarSection, insertBeforeEl);
    }
    const calendarContent = calendarSection.querySelector('#calendarContent');
    calendarContent.innerHTML = '';

    // 4a) filter+sort only those with a valid scheduled date
    const scheduledGoals = all
        .filter(g => g.scheduled && typeof g.scheduled === 'string' && !isNaN(Date.parse(g.scheduled)))
        .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled));

    // 4b) group by YYYY-MM-DD
    const byDate = scheduledGoals.reduce((groups, goal) => {
        const key = goal.scheduled.slice(0, 10);
        (groups[key] = groups[key] || []).push(goal);
        return groups;
    }, {});

    // 4c) render each date + its full goal cards
    Object.keys(byDate).sort().forEach(dateKey => {
        // parse YYYY-MM-DD into a local Date at midnight
        const [year, month, day] = dateKey.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);

        // date header (now correctly local)
        const header = document.createElement('h3');
        header.textContent = dateObj.toLocaleDateString();
        calendarContent.appendChild(header);

        // each goal under that date
        byDate[dateKey].forEach(goal => {
            const wrapper = document.createElement('div');
            wrapper.className = 'decision goal-card';
            wrapper.dataset.goalId = goal.id;
            wrapper.setAttribute('draggable', 'true');
            enableGoalDragAndDrop(wrapper);

            // build the row + children
            const row = createGoalRow(goal, { hideScheduled: true });
            wrapper.appendChild(row);

            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'goal-children';
            childrenContainer.style.display = openGoalIds.has(goal.id) ? 'block' : 'none';
            wrapper.appendChild(childrenContainer);
            renderChildren(goal, all, childrenContainer);

            // expand/collapse toggle
            const toggle = row.querySelector('.toggle-triangle');
            toggle.onclick = () => {
                const open = childrenContainer.style.display === 'block';
                toggle.textContent = open ? '▶' : '▼';
                childrenContainer.style.display = open ? 'none' : 'block';
                wrapper.setAttribute('draggable', open ? 'true' : 'false');
                open ? openGoalIds.delete(goal.id) : openGoalIds.add(goal.id);
            };

            calendarContent.appendChild(wrapper);
            renderedGoalIds.add(goal.id);
        });
    });


    // 5) Completed Goals container (only once)
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
    // 6) Render remaining (unscheduled active or hidden, then completed)
    // — first, wipe out the old hidden list so unhidden items vanish
    hiddenContent.innerHTML = '';

    const remaining = sortedGoals.filter(g => !renderedGoalIds.has(g.id));
    remaining.forEach(goal => {
        const wrapper = document.createElement('div');
        wrapper.className = 'decision goal-card';
        wrapper.dataset.goalId = goal.id;

        // wire up goal drag
        wrapper.setAttribute('draggable', 'true');
        enableGoalDragAndDrop(wrapper);

        // build the row
        const row = createGoalRow(goal, { hideScheduled: true });
        wrapper.appendChild(row);

        // render this goal's children (tasks)
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'goal-children';
        childrenContainer.style.display = openGoalIds.has(goal.id) ? 'block' : 'none';
        wrapper.appendChild(childrenContainer);
        renderChildren(goal, all, childrenContainer);

        // toggle expand/collapse
        const toggleBtn = row.querySelector('.toggle-triangle');
        toggleBtn.onclick = () => {
            const open = childrenContainer.style.display === 'block';
            toggleBtn.textContent = open ? '▶' : '▼';
            childrenContainer.style.display = open ? 'none' : 'block';
            wrapper.setAttribute('draggable', open ? 'true' : 'false');
            open ? openGoalIds.delete(goal.id) : openGoalIds.add(goal.id);
        };

        // determine hidden/completed state
        const hideUntil = goal.hiddenUntil ? Date.parse(goal.hiddenUntil) || 0 : 0;
        const isHidden = hideUntil && Date.now() < hideUntil;

        if (!goal.completed && !isHidden) {
            // active goals
            goalList.appendChild(wrapper);

        } else if (isHidden) {
            // hidden goals
            const lbl = document.createElement('span');
            lbl.textContent = `Hidden until ${new Date(hideUntil).toLocaleString()}`;
            lbl.style.margin = '0 8px';
            lbl.style.fontStyle = 'italic';
            row.querySelector('.button-row').appendChild(lbl);

            const unhideBtn = document.createElement('button');
            unhideBtn.type = 'button';
            unhideBtn.textContent = 'Unhide';
            Object.assign(unhideBtn.style, {
                background: '#88c', color: '#fff',
                border: '1px solid #88c', borderRadius: '4px',
                padding: '2px 6px', cursor: 'pointer', fontSize: '0.9em',
                marginLeft: '8px'
            });
            unhideBtn.addEventListener('click', async e => {
                e.stopPropagation();
                const items = await loadDecisions();
                const idx = items.findIndex(d => d.id === goal.id);
                if (idx !== -1) {
                    items[idx].hiddenUntil = null;
                    await saveDecisions(items);
                    await renderGoalsAndSubitems();
                }
            });
            row.querySelector('.button-row').appendChild(unhideBtn);

            hiddenContent.appendChild(wrapper);

        } else {
            // completed goals
            completedList.appendChild(wrapper);
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

                console.log(
                    'About to save',
                    all.length,
                    'items; missing:',
                    []  // nothing is missing here since we're only updating
                );

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
        console.log(
            'About to save',
            filtered.length,
            'items; missing:',
            all.map(d => d.id).filter(id => !filtered.find(x => x.id === id))
        );
        renderGoalsAndSubitems();
    });


    // ——————— “Edit” → “Save” in-place ———————
    let editing = false;
    // In attachEditButtons, replace your existing editBtn listener with this full block:

    editBtn.addEventListener('click', async () => {
        const row = editBtn.closest('.decision-row');
        const middle = row.querySelector('.middle-group');
        const due = row.querySelector('.due-column');
        if (!middle || !due) return;

        if (!editing) {
            editing = true;
            editBtn.innerHTML = '💾';

            const textInput = document.createElement('input');
            const scheduledInput = document.createElement('input');

            textInput.value = item.text;
            textInput.style.width = '100%';

            scheduledInput.type = 'date';
            scheduledInput.value = item.scheduled || '';
            scheduledInput.style.width = '140px';

            middle.innerHTML = '';
            middle.appendChild(textInput);

            due.innerHTML = '';
            due.appendChild(scheduledInput);

        } else {
            editing = false;

            const newText = middle.querySelector('input')?.value.trim();
            const newScheduled = due.querySelector('input')?.value.trim();

            const all = await loadDecisions();
            const idx = all.findIndex(d => d.id === item.id);
            if (idx !== -1) {
                all[idx].text = newText;
                all[idx].scheduled = newScheduled;
                await saveDecisions(all);

                console.log('About to save', all.length, 'items');

                middle.textContent = newText;
                due.textContent = newScheduled;
                editBtn.innerHTML = '✏️';
            }
        }
    });


}

export function renderChildren(goal, all, container) {
    const children = all.filter(item => item.parentGoalId === goal.id);
    const now = Date.now();

    // --- Active tasks ---
    const activeTasks = children.filter(c => {
        const hideUntil = c.hiddenUntil ? Date.parse(c.hiddenUntil) || 0 : 0;
        return !c.completed && (!hideUntil || now >= hideUntil);
    });

    container.innerHTML = '';

    const taskList = document.createElement('div');
    taskList.className = 'task-list';
    container.appendChild(taskList);

    activeTasks.forEach(task => {
        const wrapper = document.createElement('div');
        wrapper.className = 'decision indent-1';
        wrapper.dataset.taskId = task.id;

        // ← insert these two lines here:
        wrapper.setAttribute('draggable', 'true');
        enableTaskDragAndDrop(wrapper, taskList, goal.id);

        const row = createGoalRow(task, { hideArrow: true, hideScheduled: true });
        // …rest of your code…
    });


    // --- Add new task form ---
    const addRow = document.createElement('div');
    addRow.className = 'inline-add-form';
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
    addBtn.addEventListener('click', async () => {
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
        // fixed console.log: refer to 'updated' instead of undefined 'items'
        console.log(
            'About to save',
            updated.length,
            'items; missing:',
            all.map(d => d.id).filter(id => !updated.find(x => x.id === id))
        );
        inputText.value = '';
        renderChildren(goal, updated, container);
    });


    addRow.append(inputText, addBtn);
    container.appendChild(addRow);

    // --- Completed tasks under this goal ---
    const completedTasks = children.filter(c => c.completed);
    if (completedTasks.length) {
        const doneContainer = document.createElement('div');
        doneContainer.className = 'completed-task-list';
        container.appendChild(doneContainer);

        completedTasks.forEach(task => {
            const wrapper = document.createElement('div');
            wrapper.className = 'decision indent-1 completed-decision-inline';
            wrapper.dataset.taskId = task.id;
            wrapper.setAttribute('draggable', 'false');

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

            // text + resolution
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

            // dateCompleted + delete
            const right = document.createElement('div');
            right.className = 'right-group';
            right.style.gap = '4px';
            const due = document.createElement('div');
            due.className = 'due-column';
            due.textContent = task.dateCompleted || '';
            const buttonWrap = document.createElement('div');
            buttonWrap.className = 'button-row';
            attachTaskButtons(task, row, doneContainer);

            right.append(due, buttonWrap);

            row.append(left, middle, right);
            wrapper.appendChild(row);
            doneContainer.appendChild(wrapper);
        });
    }
}



