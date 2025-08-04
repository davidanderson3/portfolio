import { loadDecisions, loadLists } from './helpers.js';

// Map of task id -> recurrence category (daily/weekly/monthly)
let taskCategoryMap = {};

const COMPLETION_KEY = 'taskCompletions';

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
  container.innerHTML = '';
}

async function renderDailyReport(items, user, db) {
  const container = document.getElementById('dailyReport');
  if (!container) return;
  container.innerHTML = '<h3>Daily Completions</h3><table class="completion-table"></table>';

  // Build map of task ids to recurrence category
  taskCategoryMap = {};
  for (const item of items) {
    if (item.type === 'task' && item.recurs)
      taskCategoryMap[item.id] = item.recurs;
  }
  const categories = ['daily', 'weekly', 'monthly'].filter(c =>
    Object.values(taskCategoryMap).includes(c)
  );

  let completionMap = {};
  if (user && db) {
    const snap = await db.collection('taskCompletions').doc(user.uid).get();
    completionMap = snap.exists ? snap.data() : {};
  } else {
    completionMap = JSON.parse(localStorage.getItem(COMPLETION_KEY) || '{}');
  }

  const labels = getLastNDates(7);
  const table = container.querySelector('table');

  // Header row with date labels (MM-DD)
  const header = document.createElement('tr');
  header.appendChild(document.createElement('th'));
  for (const date of labels) {
    const th = document.createElement('th');
    th.textContent = date.slice(5);
    header.appendChild(th);
  }
  table.appendChild(header);

  // Rows for each category
  for (const cat of categories) {
    const tr = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    tr.appendChild(labelCell);

    for (const date of labels) {
      const td = document.createElement('td');
      const dot = document.createElement('span');
      dot.className = 'completion-dot';
      dot.dataset.date = date;
      dot.dataset.cat = cat;
      if (
        (completionMap[date] || []).some(id => taskCategoryMap[id] === cat)
      )
        dot.classList.add('completed');
      td.appendChild(dot);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

export function updateCompletionDots(map) {
  const container = document.getElementById('dailyReport');
  if (!container) return;
  container.querySelectorAll('.completion-dot').forEach(dot => {
    const date = dot.dataset.date;
    const cat = dot.dataset.cat;
    if (
      map[date] && map[date].some(id => taskCategoryMap[id] === cat)
    )
      dot.classList.add('completed');
    else dot.classList.remove('completed');
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
