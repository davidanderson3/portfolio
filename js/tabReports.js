import { loadDecisions, loadLists } from './helpers.js';

export async function initTabReports(user, db) {
  const decisions = await loadDecisions();
  renderGoalsReport(decisions);
  renderDailyReport(decisions);
  const lists = await loadLists();
  renderListsReport(lists);
  // Calendar and Metrics tabs currently have no data-driven reports
}

function renderGoalsReport(items) {
  const container = document.getElementById('goalsReport');
  if (!container) return;
  const goals = items.filter(i => i.type === 'goal');
  const completed = goals.filter(g => g.completed).length;
  container.textContent = `Total goals: ${goals.length}. Completed: ${completed}. Pending: ${goals.length - completed}.`;
}

function renderDailyReport(items) {
  const container = document.getElementById('dailyReport');
  if (!container) return;
  const tasks = items.filter(i => i.type === 'task' && i.recurs === 'daily');
  container.textContent = `Daily tasks: ${tasks.length}`;
}

function renderListsReport(lists) {
  const container = document.getElementById('listsReport');
  if (!container) return;
  container.textContent = `Lists: ${lists.length}`;
}
