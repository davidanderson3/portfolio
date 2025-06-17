import { loadDecisions, saveDecisions, generateId } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems } from './render.js';
import { initAuth } from './auth.js';
import { db } from './auth.js';
import { showDailyLogPrompt } from './dailyLog.js';
import { initWizard } from './wizard.js';
import { renderDailyTaskReport } from './report.js';

let currentUser = null;
window.currentUser = null;

window.addEventListener('DOMContentLoaded', () => {
  const uiRefs = {};

  // Safely collect available UI refs
  [
    'loginBtn', 'logoutBtn', 'userEmail', 'addGoalBtn',
    'goalWizard', 'wizardStep', 'wizardNextBtn',
    'wizardBackBtn', 'wizardCancelBtn'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) uiRefs[id] = el;
  });

  initAuth(uiRefs, (user) => {
    currentUser = user;
    window.currentUser = user;

    // Safely clear goal & task containers if they exist
    const goalList = document.getElementById('goalList');
    if (goalList) goalList.innerHTML = '';

    const completedList = document.getElementById('completedList');
    if (completedList) completedList.innerHTML = '';

    const dailyList = document.getElementById('dailyTasksList');
    if (dailyList) dailyList.innerHTML = '';

    if (window.openGoalIds) window.openGoalIds.clear?.();

    if (user) {
      if (dailyList) {
        renderDailyTasks(user, db).then(() => {
          if (goalList || completedList) {
            renderGoalsAndSubitems(user, db);
          }
          showDailyLogPrompt(user, db);

          // ✅ Only render the report if the report table is present
          if (document.getElementById('reportBody')) {
            renderDailyTaskReport(user, db);
          }
        });
      } else {
        // If no daily list, still try to render report immediately
        if (document.getElementById('reportBody')) {
          renderDailyTaskReport(user, db);
        }
      }
    }
    if (user) {
      loadDecisions().then(data => {
        const backup = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(backup);
        a.download = `auto-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      });
    }

  });

  // Only run wizard if wizard UI is present
  if (uiRefs.goalWizard && uiRefs.wizardStep) {
    initWizard(uiRefs);
  }
});
