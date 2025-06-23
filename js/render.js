import {
    initializeGlobalDragHandlers,
    enableGoalDragAndDrop
} from './dragAndDrop.js';

import {
    loadDecisions,
    saveDecisions,
    saveGoalOrder
} from './helpers.js';

import { db } from './auth.js';

import {
    attachTaskButtons,
    renderChildren
} from './tasks.js';

const openGoalIds = new Set();
const goalList = document.getElementById('goalList');
const completedList = document.getElementById('completedList');

initializeGlobalDragHandlers();

export function createGoalRow(goal, options = {}) {
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

        // ← Updated handler:
        schedInput.onchange = async () => {
            // 1) Persist the new date
            const items = await loadDecisions();
            const idx = items.findIndex(d => d.id === goal.id);
            if (idx === -1) return;
            items[idx].scheduled = schedInput.value || null;
            await saveDecisions(items);

            // 2) Remove this card from whatever list it's in
            const card = schedInput.closest('.decision.goal-card');
            if (card) card.remove();

            // 3) Render it into the calendar:
            const calendarContent = document.getElementById('calendarContent');
            // ensure calendarContent exists
            if (calendarContent) {
                // clear out just the calendar and rebuild its scheduled goals
                calendarContent.innerHTML = '';
                renderCalendarSection(items, calendarContent);
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
    clearDOM();
    const { allDecisions, sortedGoals } = await loadAndSyncGoals();
    const hiddenContent = initHiddenSection();
    const calendarContent = initCalendarSection();
    initCompletedSection();

    renderCalendarSection(allDecisions, calendarContent);
    await renderRemainingGoals(allDecisions, sortedGoals, hiddenContent);
}

function clearDOM() {
    goalList.innerHTML = '';
    completedList.innerHTML = '';
}

async function loadAndSyncGoals() {
    const allDecisions = await loadDecisions();
    const goals = allDecisions.filter(d => d.type === 'goal' && !d.parentGoalId);
    const goalMap = Object.fromEntries(goals.map(g => [g.id, g]));

    const snap = await db
        .collection('decisions')
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
    return { allDecisions, sortedGoals };
}

function initHiddenSection() {
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
    return hiddenSection.querySelector('#hiddenContent');
}

function initCalendarSection() {
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
        const insertBeforeEl = metricsContainer || document.getElementById('hiddenList');
        insertBeforeEl.parentNode.insertBefore(calendarSection, insertBeforeEl);
    }
    const calendarContent = calendarSection.querySelector('#calendarContent');
    calendarContent.innerHTML = '';
    return calendarContent;
}

function initCompletedSection() {
    if (document.getElementById('completedSection')) return;
    const completedSection = document.createElement('div');
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

function renderCalendarSection(all, calendarContent) {
    const scheduled = all
        .filter(g => g.scheduled && !isNaN(Date.parse(g.scheduled)))
        .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled));

    const byDate = scheduled.reduce((groups, goal) => {
        const key = goal.scheduled.slice(0, 10);
        (groups[key] = groups[key] || []).push(goal);
        return groups;
    }, {});

    Object.keys(byDate)
        .sort()
        .forEach(dateKey => {
            const [y, m, d] = dateKey.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);

            const header = document.createElement('h3');
            header.textContent = dateObj.toLocaleDateString();
            calendarContent.appendChild(header);

            byDate[dateKey].forEach(goal => {
                const wrapper = makeGoalWrapper(goal);
                const row = createGoalRow(goal, { hideScheduled: true });
                wrapper.appendChild(row);

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'goal-children';
                childrenContainer.style.display = openGoalIds.has(goal.id) ? 'block' : 'none';
                wrapper.appendChild(childrenContainer);
                renderChildren(goal, all, childrenContainer);

                setupToggle(wrapper, row, childrenContainer, goal.id);
                calendarContent.appendChild(wrapper);
            });
        });
}

async function renderRemainingGoals(all, sortedGoals, hiddenContent) {
    hiddenContent.innerHTML = '';
    const now = Date.now();
    const rendered = new Set(); // track those from calendar
    // calendar-rendered IDs were only in renderCalendarSection,
    // but we’d need to collect them if you mix active+scheduled in one set.

    sortedGoals.forEach(goal => {
        if (rendered.has(goal.id)) return;

        const wrapper = makeGoalWrapper(goal);
        const row = createGoalRow(goal, { hideScheduled: true });
        wrapper.appendChild(row);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'goal-children';
        childrenContainer.style.display = openGoalIds.has(goal.id) ? 'block' : 'none';
        wrapper.appendChild(childrenContainer);
        renderChildren(goal, all, childrenContainer);

        setupToggle(wrapper, row, childrenContainer, goal.id);

        const hideUntil = goal.hiddenUntil ? Date.parse(goal.hiddenUntil) || 0 : 0;
        const isHidden = hideUntil && now < hideUntil;

        if (!goal.completed && !isHidden) {
            goalList.appendChild(wrapper);
        } else if (isHidden) {
            addHiddenControls(wrapper, row, goal, hiddenContent);
        } else {
            completedList.appendChild(wrapper);
        }
    });
}

function makeGoalWrapper(goal) {
    const wrapper = document.createElement('div');
    wrapper.className = 'decision goal-card';
    wrapper.dataset.goalId = goal.id;
    wrapper.setAttribute('draggable', 'true');
    enableGoalDragAndDrop(wrapper);
    return wrapper;
}

function setupToggle(wrapper, row, childrenContainer, id) {
    const toggle = row.querySelector('.toggle-triangle');
    toggle.onclick = () => {
        const open = childrenContainer.style.display === 'block';
        toggle.textContent = open ? '▶' : '▼';
        childrenContainer.style.display = open ? 'none' : 'block';
        wrapper.setAttribute('draggable', open ? 'true' : 'false');
        open ? openGoalIds.delete(id) : openGoalIds.add(id);
    };
}

function addHiddenControls(wrapper, row, goal, hiddenContent) {
    const lbl = document.createElement('span');
    const hideUntil = Date.parse(goal.hiddenUntil);
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
}

/**
 * Attach ✏️, 🕒, ❌ buttons to a goal-row.
 *
 * @param {Object} item         The goal object
 * @param {HTMLElement} buttonWrap  The .button-row container in the goal’s row
 */
function attachEditButtons(item, buttonWrap) {
    // ✏️ Edit icon button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit';
    Object.assign(editBtn.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.2em'
    });
    buttonWrap.appendChild(editBtn);

    // 🕒 Hide select (only for incomplete goals)
    if (!item.completed) {
        const clockBtn = document.createElement('button');
        clockBtn.type = 'button';
        clockBtn.innerHTML = '🕒';
        clockBtn.title = 'Temporarily hide';
        Object.assign(clockBtn.style, {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.2em'
        });
        buttonWrap.appendChild(clockBtn);

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
            btn.addEventListener('mouseenter', () => btn.style.background = '#f0f0f0');
            btn.addEventListener('mouseleave', () => btn.style.background = 'white');

            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const all = await loadDecisions();
                const idx = all.findIndex(d => d.id === item.id);
                if (idx === -1) return;
                all[idx].hiddenUntil = new Date(Date.now() + opt.value * 3600 * 1000).toISOString();
                await saveDecisions(all);
                menu.style.display = 'none';
                const wrapper = buttonWrap.closest('.decision.goal-card');
                if (wrapper) wrapper.style.display = 'none';
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
    Object.assign(deleteBtn.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.2em'
    });
    buttonWrap.appendChild(deleteBtn);

    // Prevent clicks from interfering with drag
    [editBtn, deleteBtn].forEach(btn => {
        btn.addEventListener('mousedown', e => e.stopPropagation());
        btn.addEventListener('click', e => e.stopPropagation());
    });

    // **New delete handler: only remove this card**
    deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete goal: "${item.text}"?`)) return;
        const all = await loadDecisions();
        const filtered = all.filter(d => d.id !== item.id && d.parentGoalId !== item.id);
        await saveDecisions(filtered);
        const wrapper = deleteBtn.closest('.decision.goal-card');
        if (wrapper) wrapper.remove();
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
                middle.textContent = newText;
                due.textContent = newScheduled;
                editBtn.innerHTML = '✏️';
            }
        }
    });
}




