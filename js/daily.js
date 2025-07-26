import { loadDecisions, saveDecisions, generateId, makeIconBtn, linkify, pickDate } from './helpers.js';
import { db, currentUser } from './auth.js';
import { createCalendarEvent } from './googleCalendar.js';

// Shared skip intervals (same as goals)
const skipOptions = [
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

export async function quickAddTask(recurs, text) {
  const newTask = {
    id: generateId(),
    type: 'task',
    text: `${text}`,
    notes: '',
    recurs,
    parentGoalId: null,
    completed: false,
    dateCompleted: '',
    resolution: '',
    dependencies: [],
    skipUntil: null
  };
  const updated = [...await loadDecisions(), newTask];
  await saveDecisions(updated);
  await renderDailyTasks(currentUser, db);
}

const COMPLETION_KEY = 'taskCompletions';

export async function renderDailyTasks(currentUser, db) {
  const panel = document.getElementById('dailyPanel');
  if (!panel) return;

  // — ensure our container exists
  let container = panel.querySelector('#dailyTasksList');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dailyTasksList';
    container.className = 'decision-container';
    panel.appendChild(container);
  }
  // — ensure our weekly container exists
  const wrapper = container.parentElement || panel;
  let weeklyContainer = panel.querySelector('#weeklyTasksList');
  if (!weeklyContainer) {
    weeklyContainer = document.createElement('div');
    weeklyContainer.id = 'weeklyTasksList';
    weeklyContainer.className = 'decision-container';
    wrapper.appendChild(weeklyContainer);
  }
  // — ensure our monthly container exists
  let monthlyContainer = panel.querySelector('#monthlyTasksList');
  if (!monthlyContainer) {
    monthlyContainer = document.createElement('div');
    monthlyContainer.id = 'monthlyTasksList';
    monthlyContainer.className = 'decision-container';
    wrapper.appendChild(monthlyContainer);
  }
  // — Inject CSS once to remove green focus/active backgrounds on buttons
  if (!document.getElementById('dailyTasks-btn-reset-css')) {
    const style = document.createElement('style');
    style.id = 'dailyTasks-btn-reset-css';
    style.textContent = `
      .daily-task-wrapper button:focus,
      .daily-task-wrapper button:active {
        background: none !important;
        outline: none !important;
      }
      @keyframes flash {
        0%   { background-color: #ffff99; }
        100% { background-color: transparent; }
      }
      .flash {
        animation: flash 1s ease-out;
      }
    `;
    document.head.appendChild(style);
  }

  // — Clear and load all tasks
  container.innerHTML = '';
  weeklyContainer.innerHTML = '';
  monthlyContainer.innerHTML = '';
  const all = await loadDecisions();

  // — Migrate legacy “[Daily]” flags
  let migrated = false;
  for (const t of all) {
    if (t.type === 'task' && t.text.startsWith('[Daily]') && !t.recurs) {
      t.recurs = 'daily';
      migrated = true;
    }
  }
  if (migrated) {
    try { await saveDecisions(all); }
    catch (err) { console.error(err); alert('⚠️ Failed to migrate old tasks.'); }
  }

  // ——— No add form for recurring tasks

  // — Load today’s completions
  // — Compute keys and completion sets
  const todayKey = new Date().toLocaleDateString('en-CA');
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekKey = monday.toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKey = monthStart.toISOString().split('T')[0];
  let completionMap = {};
  if (currentUser) {
    const snap = await db.collection('taskCompletions').doc(currentUser.uid).get();
    completionMap = snap.exists ? snap.data() : {};
  } else {
    completionMap = JSON.parse(localStorage.getItem(COMPLETION_KEY) || '{}');
  }
  const dailyDone = new Set(completionMap[todayKey] || []);
  const weeklyDone = new Set(completionMap[weekKey] || []);
  const monthlyDone = new Set(completionMap[monthKey] || []);

  // ——— No weekly or monthly add forms

  // Track completions for each recurrence period
  const doneDaily = new Set(completionMap[todayKey] || []);
  const doneWeekly = new Set(completionMap[weekKey] || []);
  const doneMonthly = new Set(completionMap[monthKey] || []);

  // — Prepare and split lists
  const nowMs = Date.now();
  const dailyAll = all.filter(t =>
    t.type === 'task' &&
    t.recurs === 'daily' &&
    (!t.skipUntil || nowMs >= new Date(t.skipUntil).getTime())
  );
  const activeList = dailyAll.filter(t => !doneDaily.has(t.id));

  // — Render only active tasks
  for (const t of activeList)
    container.appendChild(makeTaskElement(t, 'daily'));
  const weeklyAll = all.filter(t =>
    t.type === 'task' &&
    t.recurs === 'weekly' &&
    (!t.skipUntil || nowMs >= new Date(t.skipUntil).getTime())
  );
  const weeklyActive = weeklyAll.filter(t => !doneWeekly.has(t.id));

  for (const t of weeklyActive)
    weeklyContainer.appendChild(makeTaskElement(t, 'weekly'));

  const monthlyAll = all.filter(t =>
    t.type === 'task' &&
    t.recurs === 'monthly' &&
    (!t.skipUntil || nowMs >= new Date(t.skipUntil).getTime())
  );
  const monthlyActive = monthlyAll.filter(t => !doneMonthly.has(t.id));

  for (const t of monthlyActive)
    monthlyContainer.appendChild(makeTaskElement(t, 'monthly'));


  // ——— Helpers —————————————————————————

  async function onToggleTaskCompletion(task, cb, wrapper, listEl, setRef, key) {
    try {
      completionMap[key] = completionMap[key] || [];
      if (cb.checked) {
        completionMap[key].push(task.id);
        setRef.add(task.id);
      } else {
        completionMap[key] = completionMap[key].filter(id => id !== task.id);
        setRef.delete(task.id);
      }
      if (currentUser) {
        await db.collection('taskCompletions').doc(currentUser.uid).set(completionMap);
      } else {
        localStorage.setItem(COMPLETION_KEY, JSON.stringify(completionMap));
      }
      if (cb.checked) {
        wrapper.remove();
      } else {
        listEl.prepend(wrapper);
      }
    } catch (err) {
      console.error(err);
      alert('⚠️ Could not update completion. Reverting.');
      cb.checked = !cb.checked;
    }
  }

  function makeTaskElement(task, period = 'daily') {
    const config = {
      daily: { set: doneDaily, key: todayKey, container: container },
      weekly: { set: doneWeekly, key: weekKey, container: weeklyContainer },
      monthly: { set: doneMonthly, key: monthKey, container: monthlyContainer }
    };
    const { set, key, container: listEl } = config[period];
    const isDone = set.has(task.id);
    const wrapper = document.createElement('div');
    wrapper.className = 'daily-task-wrapper';
    wrapper.draggable = true;
    wrapper.dataset.taskId = task.id;
    Object.assign(wrapper.style, {
      pointerEvents: 'auto',
      userSelect: 'none',
      touchAction: 'auto',
      minHeight: '120px',
      position: 'relative',
      zIndex: '1'
    });

    const row = document.createElement('div');
    row.className = 'daily-task';
    Object.assign(row.style, {
      display: 'grid',
      gridTemplateColumns: '24px 1fr auto',
      alignItems: 'center',
      columnGap: '10px',
      padding: '6px 12px',
      borderRadius: '8px',
      background: '#fffaf0',
      borderLeft: '4px solid #ffbb55',
      marginBottom: '6px',
      opacity: isDone ? '0.6' : '1'
    });

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isDone;
    cb.addEventListener('change', () =>
      onToggleTaskCompletion(task, cb, wrapper, listEl, set, key)
    );

    const label = document.createElement('div');
    const titleSpan = document.createElement('div');
    titleSpan.innerHTML = linkify(task.text.replace(/^\[Daily\]\s*/, ''));
    label.appendChild(titleSpan);
    if (task.notes) {
      const noteSpan = document.createElement('div');
      noteSpan.className = 'note-text';
      noteSpan.innerHTML = linkify(task.notes);
      label.appendChild(noteSpan);
    }
    Object.assign(label.style, {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    const btns = document.createElement('div');
    btns.style.display = 'flex';
    btns.style.gap = '8px';

    // Move up
    btns.append(makeIconBtn('⬆️', 'Move up', async () => {
      const prev = wrapper.previousElementSibling;
      if (prev && prev.classList.contains('daily-task-wrapper')) {
        listEl.insertBefore(wrapper, prev);
        if (period === 'daily') {
          try { await persistReorder(); }
          catch { alert('⚠️ Could not save new order.'); }
        }
      }
    }));

    // Edit
    btns.append(makeIconBtn('✏️', 'Edit', async () => {
      const original = task.text.replace(/^\[Daily\]\s*/, '');
      const edited = prompt('Edit task:', original);
      if (edited === null) return;
      const noteInput = prompt('Task notes:', task.notes || '');
      try {
        const allDecs = await loadDecisions();
        const idx = allDecs.findIndex(t => t.id === task.id);
        if (idx === -1) return;
        allDecs[idx].text = `[Daily] ${edited.trim()}`;
        if (noteInput !== null) allDecs[idx].notes = noteInput.trim();
        await saveDecisions(allDecs);
        task.text = allDecs[idx].text;
        task.notes = allDecs[idx].notes;
        label.innerHTML = '';
        const tSpan = document.createElement('div');
        tSpan.innerHTML = linkify(edited.trim());
        label.appendChild(tSpan);
        if (task.notes) {
          const nSpan = document.createElement('div');
          nSpan.className = 'note-text';
          nSpan.innerHTML = linkify(task.notes);
          label.appendChild(nSpan);
        }
      } catch {
        alert('⚠️ Could not save edit.');
      }
    }));

    // Skip interval (clock + dropdown menu)
    const clockBtn = makeIconBtn('🕒', 'Skip interval', () => toggleMenu());
    const menu = document.createElement('div');
    Object.assign(menu.style, {
      position: 'absolute', background: '#fff', border: '1px solid #ccc', borderRadius: '6px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)', padding: '6px 0', fontSize: '0.9em',
      display: 'none', zIndex: '9999', minWidth: '120px'
    });
    document.body.appendChild(menu);
    skipOptions.forEach(opt => {
      const optBtn = document.createElement('button'); optBtn.type = 'button'; optBtn.textContent = opt.label;
      Object.assign(optBtn.style, {
        display: 'block', width: '100%', padding: '4px 12px', border: 'none', background: 'white',
        color: '#333', textAlign: 'left', cursor: 'pointer'
      });
      optBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const allDecs = await loadDecisions();
        const idx = allDecs.findIndex(d => d.id === task.id);
        if (idx === -1) return;
        allDecs[idx].skipUntil = new Date(Date.now() + opt.value * 3600000).toISOString();
        await saveDecisions(allDecs);
        menu.style.display = 'none'; wrapper.remove();
      });
      menu.appendChild(optBtn);
    });
    function toggleMenu() {
      const rect = clockBtn.getBoundingClientRect();
      menu.style.top = `${rect.bottom + window.scrollY}px`;
      menu.style.left = `${rect.left + window.scrollX}px`;
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && e.target !== clockBtn) menu.style.display = 'none';
    });
    btns.append(clockBtn);

    // Skip until next day
    btns.append(makeIconBtn('⏭️', 'Skip until next day', async () => {
      try {
        const allDecs = await loadDecisions();
        const idx = allDecs.findIndex(t => t.id === task.id);
        if (idx === -1) return;
        const now = new Date();
        const tm = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        allDecs[idx].skipUntil = tm.toISOString();
        await saveDecisions(allDecs);
        wrapper.remove();
      } catch { alert('⚠️ Could not skip task.'); }
    }));

    // Add to calendar for weekly tasks
    if (period === 'weekly') {
      btns.append(
        makeIconBtn('📅', 'Add to calendar', async () => {
          const date = await pickDate(
            new Date().toISOString().slice(0, 10)
          );
          if (!date) return;
          try {
            await createCalendarEvent(task.text, date.trim(), date.trim(), 'WEEKLY');
          } catch (err) {
            console.error('Failed to create calendar event', err);
          }
        })
      );
    }

    // Delete
    btns.append(makeIconBtn('❌', 'Delete', async () => {
      if (!confirm('Delete this task?')) return;
      try {
        const remaining = (await loadDecisions()).filter(t => t.id !== task.id);
        await saveDecisions(remaining);
        wrapper.remove();
      } catch {
        alert('⚠️ Could not delete task.');
      }
    }));

    row.append(cb, label, btns);
    wrapper.appendChild(row);
    return wrapper;
  }

  async function persistReorder() {
    const wrappers = Array.from(container.querySelectorAll('.daily-task-wrapper'));
    const ids = wrappers.map(w => w.dataset.taskId);
    const others = all.filter(t => !ids.includes(t.id));
    const reordered = ids.map(id => all.find(t => t.id === id)).filter(Boolean);
    await saveDecisions([...others, ...reordered]);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('dailyPanel');
  if (panel && panel.style.display !== 'none') {
    // Render tasks for the current user if the Daily tab is visible
    renderDailyTasks(currentUser, db);
  }
});

window.renderDailyTasks = renderDailyTasks;
window.quickAddTask = quickAddTask;
