import {
    initializeGlobalDragHandlers,
    enableGoalDragAndDrop
} from './dragAndDrop.js';

import {
    loadDecisions,
    saveDecisions,
    saveGoalOrder,
    generateId,
    makeIconBtn,
    formatDaysUntil,
    linkify,
    pickDate,
    pickDateRange
} from './helpers.js';

import { db } from './auth.js';

import {
    attachTaskButtons,
    renderChildren
} from './tasks.js';
import { createCalendarEvent } from './googleCalendar.js';


const openGoalIds = new Set();
// Expose for cleanup between sign-ins
window.openGoalIds = openGoalIds;
const goalList = document.getElementById('goalList');
const completedList = document.getElementById('completedList');

initializeGlobalDragHandlers();

export async function addCalendarGoal(date = '') {
    const text = prompt('New goal:');
    if (!text) return;
    const range = await pickDateRange(
        date || new Date().toISOString().slice(0, 10),
        ''
    );
    if (!range.start) return;
    const all = await loadDecisions();
    const newGoal = {
        id: generateId(),
        type: 'goal',
        text: text.trim(),
        notes: '',
        completed: false,
        resolution: '',
        dateCompleted: '',
        parentGoalId: null,
        hiddenUntil: null,
        scheduled: range.start.trim(),
        scheduledEnd: range.end.trim() || ''
    };
    await saveDecisions([...all, newGoal]);
    const recur = prompt('Repeat how often? (daily/weekly/monthly or blank for none):', '') || '';
    try {
        await createCalendarEvent(newGoal.text, newGoal.scheduled, newGoal.scheduledEnd || newGoal.scheduled, recur);
    } catch (err) {
        console.error('Failed to create calendar event', err);
    }
    appendGoalToDOM(newGoal, [...all, newGoal]);
    const calendarContent = document.getElementById('calendarContent');
    if (calendarContent) {
        const refreshed = initCalendarSection();
        renderCalendarSection([...all, newGoal], refreshed);
    }
}

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

    // only attach the onchange logic if this row is a goal
    if (goal.type === 'goal') {
        checkbox.onchange = async () => {
            // 1) Update DB
            const items = await loadDecisions();
            const idx = items.findIndex(d => d.id === goal.id);
            if (idx === -1) return;

            items[idx].completed = checkbox.checked;
            items[idx].dateCompleted = checkbox.checked
                ? new Date().toISOString()
                : null;

            // 2) Update the UI immediately
            if (options.stayPut) {
                if (typeof options.onToggle === 'function') {
                    await options.onToggle(checkbox.checked, items);
                } else {
                    await renderGoalsAndSubitems();
                }
            } else {
                const wrapper = row.closest('.decision.goal-card') || row;
                if (checkbox.checked) {
                    completedList.appendChild(wrapper);
                } else {
                    goalList.appendChild(wrapper);
                }
            }

            // 3) Persist changes after updating UI
            await saveDecisions(items);
            updateGoalCounts(items);
        };
    }

    left.append(toggle, checkbox);
    row.appendChild(left);

    // ── Middle group: text ──
    const middle = document.createElement('div');
    middle.className = 'middle-group';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'title-column';
    titleDiv.innerHTML = linkify(goal.text);
    middle.appendChild(titleDiv);
    if (goal.notes) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-text';
        noteDiv.innerHTML = linkify(goal.notes);
        middle.appendChild(noteDiv);
    }
    const buttonWrap = document.createElement('div');
    buttonWrap.className = 'button-row';
    if (goal.type === 'goal') {
        attachEditButtons(goal, buttonWrap, row, options.itemsRef);
    }
    middle.appendChild(buttonWrap);
    row.appendChild(middle);

    const due = document.createElement('div');
    due.className = 'due-column';
    const rangeText = goal.scheduledEnd && goal.scheduledEnd !== goal.scheduled
        ? `${goal.scheduled} - ${goal.scheduledEnd}`
        : (goal.scheduled || '');
    due.textContent = goal.completed ? goal.dateCompleted : rangeText;
    row.appendChild(due);
    return row;
}



export async function renderGoalsAndSubitems() {
  clearDOM();
  const { allDecisions, sortedGoals } = await loadAndSyncGoals();

  // 1) Render the calendar on the left
  const calendarContent = initCalendarSection();
  const todayList = initTodayScheduleSection();
  let weatherData = null;
  try {
    weatherData = (await window.fetchWeatherData?.())?.data || null;
  } catch (err) {
    console.error('Weather fetch failed', err);
  }
  renderCalendarSection(allDecisions, calendarContent, weatherData);
  renderTodaySchedule(allDecisions, todayList, weatherData);

  // 3) Hidden & completed goals below
  const hiddenContent = initHiddenSection();
  initCompletedSection();
  await renderRemainingGoals(allDecisions, sortedGoals, hiddenContent);
  updateGoalCounts(allDecisions);
}


function clearDOM() {
    goalList.innerHTML = '';
    completedList.innerHTML = '';
    const hiddenContent = document.getElementById('hiddenContent');
    if (hiddenContent) hiddenContent.innerHTML = '';
}

let fixedMutualParents = false;

async function fixMutualParentGoals(items) {
    if (fixedMutualParents) return;
    const parentMap = {};
    for (const it of items) {
        if (it.type === 'goal' && it.parentGoalId) {
            parentMap[it.id] = it.parentGoalId;
        }
    }
    const toClear = new Set();
    for (const [id, parentId] of Object.entries(parentMap)) {
        if (parentMap[parentId] === id) {
            toClear.add(id);
            toClear.add(parentId);
        }
    }
    if (toClear.size) {
        let changed = false;
        for (const it of items) {
            if (toClear.has(it.id) && it.parentGoalId) {
                it.parentGoalId = null;
                changed = true;
            }
        }
        if (changed) await saveDecisions(items);
    }
    fixedMutualParents = true;
}

async function loadAndSyncGoals() {
    const allDecisions = await loadDecisions();
    await fixMutualParentGoals(allDecisions);
    const goals = allDecisions.filter(d => d.type === 'goal' && !d.parentGoalId);
    const goalMap = Object.fromEntries(goals.map(g => [g.id, g]));

    const user = firebase.auth().currentUser;
    let goalOrder = [];

    if (user) {
        const snap = await db
            .collection('decisions')
            .doc(user.uid)
            .get();

        goalOrder = Array.isArray(snap.data()?.goalOrder)
            ? snap.data().goalOrder
            : [];

        const missing = goals.map(g => g.id).filter(id => !goalOrder.includes(id));
        if (missing.length) {
            goalOrder = [...goalOrder, ...missing];
            await saveGoalOrder(goalOrder);
        }
    } else {
        goalOrder = goals.map(g => g.id);
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
      <h2 style="margin-top:32px" id="hiddenHeader">
        <span id="toggleHidden" style="cursor:pointer">▶</span> <span id="hiddenLabel">Hidden Goals</span>
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

// initCalendarSection.js
function initCalendarSection() {
    // grab the static panel in your HTML:
    const calendarContent = document.getElementById('calendarContent');
    if (!calendarContent) {
        throw new Error('No #calendarContent found in DOM');
    }
    calendarContent.innerHTML = '';   // clear prior render
    return calendarContent;
}

function initTodayScheduleSection() {
    let container = document.getElementById('todaySchedule');
    if (!container) {
        const panel = document.getElementById('calendarPanel');
        const parent =
            panel?.querySelector('.right-column') ||
            panel?.querySelector('.full-column') ||
            document.body;
        container = document.createElement('div');
        container.id = 'todaySchedule';
        const target = document.getElementById('calendarContent');
        if (target && target.parentElement === parent) {
            parent.insertBefore(container, target);
        } else {
            parent.appendChild(container);
        }
    }
    container.innerHTML = '<h3>Today\'s Schedule</h3><div id="todayScheduleList"></div>';
    return container.querySelector('#todayScheduleList');
}


export function renderTodaySchedule(all, listEl, weather) {
    if (!listEl) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const todays = all.filter(g => g.scheduled && g.scheduled.startsWith(todayKey));
    const byHour = {};
    todays.forEach(g => {
        const h = new Date(g.scheduled).getHours();
        (byHour[h] = byHour[h] || []).push(g);
    });

    const weatherByHour = {};
    if (weather && weather.hourly && weather.hourly.time) {
        weather.hourly.time.forEach((t, idx) => {
            const d = new Date(t);
            if (t.startsWith(todayKey)) {
                weatherByHour[d.getHours()] = {
                    temp: weather.hourly.temperature_2m[idx],
                    rain: weather.hourly.precipitation_probability
                        ? weather.hourly.precipitation_probability[idx]
                        : undefined
                };
            }
        });
    }

    listEl.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        const row = document.createElement('div');
        row.className = 'hour-row time-box';
        const label = document.createElement('div');
        label.className = 'hour-label';
        label.textContent = `${String(h).padStart(2, '0')}:00`;
        const w = weatherByHour[h];
        if (w) {
            const span = document.createElement('span');
            span.className = 'hour-weather';
            const icon = window.chooseWeatherIcon ? window.chooseWeatherIcon(w.rain) : '';
            span.textContent = `${icon} ${w.temp}\u00B0`;
            label.appendChild(span);
        }
        row.appendChild(label);

        const cell = document.createElement('div');
        cell.className = 'hour-events';
        const events = byHour[h] || [];
        if (events.length) {
            const ul = document.createElement('ul');
            events.forEach(ev => {
                const li = document.createElement('li');
                li.textContent = ev.text;
                ul.appendChild(li);
            });
            cell.appendChild(ul);
        }
        row.appendChild(cell);
        listEl.appendChild(row);
    }
}


function initCompletedSection() {
    if (document.getElementById('completedSection')) return;
    const completedSection = document.createElement('div');
    completedSection.id = 'completedSection';

    const hdr = document.createElement('h2');
    hdr.id = 'completedHeader';
    const toggle = document.createElement('span');
    toggle.textContent = '▶';
    toggle.style.cursor = 'pointer';
    hdr.appendChild(toggle);
    const label = document.createElement('span');
    label.id = 'completedLabel';
    label.textContent = ' Completed';
    hdr.appendChild(label);

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

function renderCalendarSection(all, calendarContent, weather) {
    const dailyWeather = {};
    if (weather && weather.daily && weather.daily.time) {
        weather.daily.time.forEach((t, idx) => {
            dailyWeather[t] = {
                high: weather.daily.temperature_2m_max[idx],
                low: weather.daily.temperature_2m_min[idx],
                rain: weather.daily.precipitation_probability_max
                    ? weather.daily.precipitation_probability_max[idx]
                    : undefined
            };
        });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 6);

    for (let d = new Date(start); d <= end;) {
        const dow = d.getDay();

        if (dow === 6) {
            const section = document.createElement('div');
            section.className = 'weekend-section';
            section.appendChild(createDayHeader(d, dailyWeather));
            const sun = new Date(d); sun.setDate(d.getDate() + 1);
            if (sun <= end) section.appendChild(createDayHeader(sun, dailyWeather));
            calendarContent.appendChild(section);
            d.setDate(d.getDate() + 2);
        } else if (dow === 0) {
            const section = document.createElement('div');
            section.className = 'weekend-section';
            section.appendChild(createDayHeader(d, dailyWeather));
            calendarContent.appendChild(section);
            d.setDate(d.getDate() + 1);
        } else {
            calendarContent.appendChild(createDayHeader(d, dailyWeather));
            d.setDate(d.getDate() + 1);
        }
    }

    function createDayHeader(date, weatherMap) {
        const header = document.createElement('h3');
        const dowLabel = date.toLocaleDateString(undefined, { weekday: 'short' });
        const dateStr = date.toLocaleDateString();
        const key = date.toISOString().slice(0, 10);
        const w = weatherMap[key];
        const weatherInfo = w ? ` ${window.chooseWeatherIcon?.(w.rain) || ''} ${w.high}\u00B0/${w.low}\u00B0` : '';
        header.textContent = `${dowLabel} ${dateStr}${weatherInfo}`;
        return header;
    }
}



async function renderRemainingGoals(all, sortedGoals, hiddenContent) {
    hiddenContent.innerHTML = '';
    const now = Date.now();
    const rendered = new Set();
    const completedWrappers = [];

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
            completedWrappers.push({ wrapper, date: goal.dateCompleted });
        }
    });

    completedWrappers
        .sort((a, b) => {
            const ad = Date.parse(a.date) || 0;
            const bd = Date.parse(b.date) || 0;
            return bd - ad;
        })
        .forEach(item => completedList.appendChild(item.wrapper));
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
    const hideUntil = Date.parse(goal.hiddenUntil);

    const middle = row.querySelector('.middle-group');
    const buttonRow = row.querySelector('.button-row');

    const info = document.createElement('div');
    info.className = 'hidden-info';
    info.textContent = `Hidden until ${new Date(hideUntil).toLocaleString()}`;

    const unhideBtn = document.createElement('button');
    unhideBtn.type = 'button';
    unhideBtn.textContent = 'Unhide';
    Object.assign(unhideBtn.style, {
        background: '#88c', color: '#fff',
        border: '1px solid #88c', borderRadius: '4px',
        padding: '2px 6px', cursor: 'pointer', fontSize: '0.9em'
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

    if (buttonRow) {
        middle.insertBefore(info, buttonRow);
    } else {
        middle.appendChild(info);
    }
    middle.appendChild(unhideBtn);

    wrapper.classList.add('hidden-goal');
    hiddenContent.appendChild(wrapper);
}

function updateGoalCounts(items) {
    const now = Date.now();
    const rootGoals = items.filter(i => i.type === 'goal' && !i.parentGoalId);
    const active = rootGoals.filter(g => {
        const hideUntil = g.hiddenUntil ? Date.parse(g.hiddenUntil) || 0 : 0;
        return !g.completed && (!hideUntil || now >= hideUntil);
    }).length;
    const hidden = rootGoals.filter(g => {
        const hideUntil = g.hiddenUntil ? Date.parse(g.hiddenUntil) || 0 : 0;
        return hideUntil && now < hideUntil;
    }).length;
    const completed = rootGoals.filter(g => g.completed).length;

    const goalsHeader = document.getElementById('goalsHeader');
    if (goalsHeader) goalsHeader.textContent = `Goals (${active})`;
    const hiddenLabel = document.getElementById('hiddenLabel');
    if (hiddenLabel) hiddenLabel.textContent = `Hidden Goals (${hidden})`;
    const completedLabel = document.getElementById('completedLabel');
    if (completedLabel) completedLabel.textContent = ` Completed (${completed})`;
}

export function appendGoalToDOM(goal, allItems) {
    const wrapper = makeGoalWrapper(goal);
    const row = createGoalRow(goal, { hideScheduled: true });
    wrapper.appendChild(row);

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'goal-children';
    childrenContainer.style.display = openGoalIds.has(goal.id) ? 'block' : 'none';
    wrapper.appendChild(childrenContainer);
    renderChildren(goal, allItems, childrenContainer);

    setupToggle(wrapper, row, childrenContainer, goal.id);

    goalList.appendChild(wrapper);
    updateGoalCounts(allItems);
}

/**
 * Attach ✏️, 🕒, ❌ buttons to a goal-row.
 *
 * @param {Object} item         The goal object
 * @param {HTMLElement} buttonWrap  The .button-row container in the goal’s row
 */
function attachEditButtons(item, buttonWrap, row, itemsRef) {
    // ⬆️ Move goal up
    if (row) {
        const upBtn = makeIconBtn('⬆️', 'Move goal up', async () => {
            const wrapper = row.closest('.goal-card');
            const container = wrapper?.parentElement;
            if (!wrapper || !container) return;

            let prev = wrapper.previousElementSibling;
            while (prev && !prev.dataset.goalId) {
                prev = prev.previousElementSibling;
            }
            if (!prev) return;

            container.insertBefore(wrapper, prev);

            if (!item.parentGoalId) {
                const newOrder = [...goalList.children]
                    .map(el => el.dataset.goalId)
                    .filter(Boolean);
                await saveGoalOrder(newOrder);
            } else {
                const all = await loadDecisions();
                const siblings = all.filter(
                    d => d.parentGoalId === item.parentGoalId && d.type === 'goal' && !d.completed
                );
                const other = all.filter(
                    d => d.parentGoalId !== item.parentGoalId || d.type !== 'goal' || d.completed
                );
                const ids = [...container.children]
                    .filter(el => el.dataset.goalId)
                    .map(el => el.dataset.goalId);
                const reordered = ids
                    .map(id => siblings.find(g => g.id === id))
                    .filter(Boolean);
                const updated = [...other, ...reordered];
                await saveDecisions(updated);
                if (Array.isArray(itemsRef)) {
                    itemsRef.splice(0, itemsRef.length, ...updated);
                }
            }
        });
        buttonWrap.appendChild(upBtn);
    }

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
            { label: '2 days', value: 48 },
            { label: '3 days', value: 72 },
            { label: '4 days', value: 96 },
            { label: '1 week', value: 168 },
            { label: '2 weeks', value: 336 },
            { label: '1 month', value: 720 },
            { label: '2 months', value: 1440 },
            { label: '3 months', value: 2160 }
        ];

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = opt.label;
            // mark as a postpone‐menu button so global styles skip it
            btn.classList.add('postpone-option');

            // base styling
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

            // click handler
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const all = await loadDecisions();
                const idx = all.findIndex(d => d.id === item.id);
                if (idx === -1) return;
                all[idx].hiddenUntil = new Date(
                    Date.now() + opt.value * 3600 * 1000
                ).toISOString();
                await saveDecisions(all);
                menu.style.display = 'none';
                const wrapper = buttonWrap.closest('.decision.goal-card');
                if (wrapper) wrapper.style.display = 'none';
                updateGoalCounts(all);
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

    // 📅 Schedule button
    const calendarBtn = makeIconBtn('📅', 'Add to calendar', async () => {
        const range = await pickDateRange(
            item.scheduled || new Date().toISOString().slice(0, 10),
            item.scheduledEnd || ''
        );
        if (!range.start) return;
        const recurrence = prompt(
            'Repeat how often? (daily/weekly/monthly or blank for none):',
            ''
        ) || '';
        const all = await loadDecisions();
        const idx = all.findIndex(d => d.id === item.id);
        if (idx !== -1) {
            all[idx].scheduled = range.start.trim();
            all[idx].scheduledEnd = range.end.trim();
            await saveDecisions(all);
            try {
                await createCalendarEvent(
                    item.text,
                    range.start.trim(),
                    range.end.trim() || range.start.trim(),
                    recurrence
                );
            } catch (err) {
                console.error('Failed to sync with Google Calendar', err);
            }
            renderGoalsAndSubitems();
        }
    });
    buttonWrap.appendChild(calendarBtn);

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
        updateGoalCounts(filtered);
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
            const notesInput = document.createElement('textarea');
            const scheduledInput = document.createElement('input');
            const scheduledEndInput = document.createElement('input');
            const parentSelect = document.createElement('select');

            textInput.value = item.text;
            textInput.style.width = '100%';

            notesInput.value = item.notes || '';
            notesInput.rows = 2;
            notesInput.style.width = '100%';
            notesInput.style.marginTop = '4px';

            scheduledInput.type = 'date';
            scheduledInput.value = item.scheduled || '';
            scheduledInput.style.width = '100%';

            scheduledEndInput.type = 'date';
            scheduledEndInput.value = item.scheduledEnd || '';
            scheduledEndInput.style.width = '100%';
            scheduledEndInput.style.marginTop = '4px';

            const allItems = await loadDecisions();
            const goals = allItems.filter(g =>
                g.type === 'goal' &&
                g.id !== item.id &&
                !g.completed // only active or hidden
            );
            const noneOpt = document.createElement('option');
            noneOpt.value = '';
            noneOpt.textContent = '(no parent)';
            parentSelect.appendChild(noneOpt);
            goals.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.text;
                if (g.id === item.parentGoalId) opt.selected = true;
                parentSelect.appendChild(opt);
            });
            parentSelect.style.marginLeft = '8px';
            parentSelect.style.width = '100%';

            const buttonWrap = row.querySelector('.button-row');

            middle.innerHTML = '';
            middle.appendChild(textInput);
            middle.appendChild(notesInput);

            due.innerHTML = '';
            due.appendChild(scheduledInput);
            due.appendChild(scheduledEndInput);
            due.appendChild(parentSelect);
            if (buttonWrap) {
                buttonWrap.style.marginTop = '6px';
                due.appendChild(buttonWrap);
            }
            row.classList.add('editing');

        } else {
            const newText = middle.querySelector('input')?.value.trim();
            const newNotes = middle.querySelector('textarea')?.value.trim();
            const [startInput, endInput] = due.querySelectorAll('input');
            const newScheduled = startInput?.value.trim();
            const newScheduledEnd = endInput?.value.trim();
            const newParent = due.querySelector('select')?.value || null;

            const all = await loadDecisions();
            const idx = all.findIndex(d => d.id === item.id);
            if (idx !== -1) {
                if (newParent && all.find(g => g.id === newParent)?.parentGoalId === item.id) {
                    alert('Cannot create circular parent relationship.');
                    return;
                }
                editing = false;
                const needsMove =
                    all[idx].parentGoalId !== (newParent || null) ||
                    all[idx].scheduled !== newScheduled ||
                    (all[idx].scheduledEnd || '') !== newScheduledEnd;
                all[idx].text = newText;
                all[idx].notes = newNotes;
                all[idx].scheduled = newScheduled;
                all[idx].scheduledEnd = newScheduledEnd;
                all[idx].parentGoalId = newParent || null;
                await saveDecisions(all);

                // update DOM if staying in place
                if (!needsMove) {
                    item.text = newText;
                    item.notes = newNotes;
                    item.scheduled = newScheduled;
                    item.scheduledEnd = newScheduledEnd;
                    item.parentGoalId = newParent || null;

                    const buttonWrap = row.querySelector('.button-row');

                    middle.innerHTML = '';
                    const titleDiv = document.createElement('div');
                    titleDiv.innerHTML = linkify(newText);
                    middle.appendChild(titleDiv);
                    if (newNotes) {
                        const noteDiv = document.createElement('div');
                        noteDiv.className = 'note-text';
                        noteDiv.innerHTML = linkify(newNotes);
                        middle.appendChild(noteDiv);
                    }
                    if (buttonWrap) middle.appendChild(buttonWrap);

                    due.innerHTML = '';
                    const rangeText = newScheduledEnd && newScheduledEnd !== newScheduled
                        ? `${newScheduled} - ${newScheduledEnd}`
                        : (newScheduled || '');
                    due.textContent = item.completed ? item.dateCompleted : rangeText;
                } else {
                    await renderGoalsAndSubitems();
                }
            }

            row.classList.remove('editing');
            editBtn.innerHTML = '✏️';
        }
    });
}
