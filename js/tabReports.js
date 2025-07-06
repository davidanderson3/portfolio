import { loadDecisions, loadLists } from './helpers.js';

function getLastNDates(n) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates.reverse();
}

export async function initTabReports(user, db) {
  const decisions = await loadDecisions();
  renderGoalsReport(decisions);
  await renderDailyReport(decisions, user, db);
  const lists = await loadLists();
  renderListsReport(lists);
  // Calendar and Metrics tabs currently have no data-driven reports
}

export function renderGoalsReport(items) {
  const container = document.getElementById('goalsReport');
  if (!container) return;

  const now = Date.now();
  const rootGoals = items.filter(i => i.type === 'goal' && !i.parentGoalId);
  const tasks = items.filter(i => i.type === 'task');

  const activeGoals = rootGoals.filter(g => {
    const hideUntil = g.hiddenUntil ? Date.parse(g.hiddenUntil) || 0 : 0;
    return !g.completed && (!hideUntil || now >= hideUntil);
  });
  const hiddenGoals = rootGoals.filter(g => {
    const hideUntil = g.hiddenUntil ? Date.parse(g.hiddenUntil) || 0 : 0;
    return hideUntil && now < hideUntil;
  });

  const goalMap = Object.fromEntries(items.filter(i => i.type === 'goal').map(g => [g.id, g]));

  function parentHidden(item) {
    let pid = item.parentGoalId;
    while (pid) {
      const p = goalMap[pid];
      if (!p) break;
      const h = p.hiddenUntil ? Date.parse(p.hiddenUntil) || 0 : 0;
      if (h && now < h) return true;
      pid = p.parentGoalId;
    }
    return false;
  }

  const activeTasks = tasks.filter(t => {
    if (!t.parentGoalId) return false; // only count tasks linked to a goal
    const parent = goalMap[t.parentGoalId];
    if (!parent || parent.completed) return false;

    const hideUntil = t.hiddenUntil ? Date.parse(t.hiddenUntil) || 0 : 0;
    const hidden =
      (hideUntil && now < hideUntil) || parentHidden(t) || parentHidden(parent);
    return !t.completed && !hidden;
  });
  const hiddenTasks = tasks.filter(t => {
    const hideUntil = t.hiddenUntil ? Date.parse(t.hiddenUntil) || 0 : 0;
    return (hideUntil && now < hideUntil) || parentHidden(t);
  });

  container.innerHTML = `
    <h3>Goal Status</h3>
    <p>Active goals: ${activeGoals.length}</p>
    <p>Active tasks: ${activeTasks.length}</p>
    <p>Hidden goals: ${hiddenGoals.length}</p>
    <p>Hidden tasks: ${hiddenTasks.length}</p>
  `;
}

async function renderDailyReport(items, user, db) {
  const container = document.getElementById('dailyReport');
  if (!container) return;
  container.innerHTML = '<h3>Daily Completions</h3><canvas></canvas>';
  const ctx = container.querySelector('canvas').getContext('2d');
  let completionMap = {};
  if (user && db) {
    const snap = await db.collection('taskCompletions').doc(user.uid).get();
    completionMap = snap.exists ? snap.data() : {};
  }
  const labels = getLastNDates(7);
  const data = labels.map(d => (completionMap[d] || []).length);
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Tasks Done',
        data,
        fill: false,
        borderColor: '#3e95cd'
      }]
    },
    options: { responsive: true }
  });
}

function renderListsReport(lists) {
  const container = document.getElementById('listsReport');
  if (!container) return;
  if (!lists.length) {
    container.textContent = 'No lists yet.';
    return;
  }
  container.innerHTML = '<h3>List Sizes</h3><canvas></canvas>';
  const ctx = container.querySelector('canvas').getContext('2d');
  const labels = lists.map(l => l.name);
  const data = lists.map(l => (l.items || []).length);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Items',
        data,
        backgroundColor: '#5bc0de'
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
  container.textContent = `Lists: ${lists.length}`;
}
