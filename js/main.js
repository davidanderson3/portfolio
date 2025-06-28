// File: js/main.js

import { loadDecisions, saveDecisions, generateId } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems } from './goals.js';
import { initAuth } from './auth.js';
import { db } from './auth.js';
import { initWizard } from './wizard.js';
import { renderDailyTaskReport } from './report.js';
import './stats.js';
import { initTabs } from './tabs.js';

// ← Import the new button-styles initializer:
import { initButtonStyles } from './buttonStyles.js';

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

    ['goalList', 'completedList', 'dailyTasksList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    window.openGoalIds?.clear();

    if (user) {
      initTabs(currentUser, db);
      renderGoalsAndSubitems(currentUser, db);
      renderDailyTasks(currentUser, db);
      if (document.getElementById('reportBody')) {
        renderDailyTaskReport(currentUser, db);
      }
      loadDecisions().then(data => {
        const key = `backup-${new Date().toISOString().slice(0,10)}`;
        localStorage.setItem(key, JSON.stringify(data));
        console.log('⚡ backup saved to localStorage');
      });
    }
  });

  if (uiRefs.wizardContainer && uiRefs.wizardStep) {
    initWizard(uiRefs);
  }

  // ← Finally, kick off the button styling:
  initButtonStyles();
});

// Expose for debugging
window.loadDecisions = loadDecisions;
