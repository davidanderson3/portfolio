// File: index.js (or whatever your main file is named)

import { loadDecisions, saveDecisions, generateId } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems } from './render.js';
import { initAuth } from './auth.js';
import { db } from './auth.js';
import { initWizard } from './wizard.js';
import { renderDailyTaskReport } from './report.js';
import './stats.js';


let currentUser = null;
window.currentUser = null;

window.addEventListener('DOMContentLoaded', () => {
  const uiRefs = {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userEmail: document.getElementById('userEmail'),
    addGoalBtn: document.getElementById('addGoalBtn'),
    wizardContainer: document.getElementById('goalWizard'),
    wizardStep: document.getElementById('wizardStep'),
    nextBtn: document.getElementById('wizardNextBtn'),
    backBtn: document.getElementById('wizardBackBtn'),
    cancelBtn: document.getElementById('wizardCancelBtn')
  };

  initAuth(uiRefs, (user) => {
    currentUser = user;
    window.currentUser = user;

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

          if (document.getElementById('reportBody')) {
            renderDailyTaskReport(user, db);
          }
        });
      } else {
        if (document.getElementById('reportBody')) {
          renderDailyTaskReport(user, db);
        }
      }

      loadDecisions().then(data => {
        localStorage.setItem(
          `backup-${new Date().toISOString().slice(0, 10)}`,
          JSON.stringify(data)
        );
        console.log('⚡ backup saved to localStorage');
      });
    }
  });

  if (uiRefs.wizardContainer && uiRefs.wizardStep) {
    initWizard(uiRefs);
  }
});

window.loadDecisions = loadDecisions;
