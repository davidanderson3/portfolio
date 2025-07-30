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
  container.innerHTML = '';
}

async function renderDailyReport(items, user, db) {
  const container = document.getElementById('dailyReport');
  if (!container) return;
  container.innerHTML = '<h3>Daily Completions</h3><div class="completion-dots"></div>';
  let completionMap = {};
  if (user && db) {
    const snap = await db.collection('taskCompletions').doc(user.uid).get();
    completionMap = snap.exists ? snap.data() : {};
  }
  const labels = getLastNDates(7);
  const row = container.querySelector('.completion-dots');
  for (const date of labels) {
    const dot = document.createElement('span');
    dot.className = 'completion-dot';
    dot.dataset.date = date;
    if ((completionMap[date] || []).length) dot.classList.add('completed');
    row.appendChild(dot);
  }
}

export function updateCompletionDots(map) {
  const container = document.getElementById('dailyReport');
  if (!container) return;
  container.querySelectorAll('.completion-dot').forEach(dot => {
    const date = dot.dataset.date;
    if (map[date] && map[date].length) dot.classList.add('completed');
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
