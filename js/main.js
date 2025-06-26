// File: main.js

import { loadDecisions, saveDecisions, generateId } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems } from './render.js';
import { initAuth } from './auth.js';
import { db } from './auth.js';
import { initWizard } from './wizard.js';
import { renderDailyTaskReport } from './report.js';
import './stats.js';
import { initTabs } from './tabs.js';

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

    // Clear existing lists
    ['goalList', 'completedList', 'dailyTasksList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    if (window.openGoalIds) window.openGoalIds.clear?.();

    if (user) {
      // Initialize tabs now that we have currentUser & db
      initTabs(currentUser, db);

      // Render goals/calendar immediately
      renderGoalsAndSubitems(currentUser, db);

      // If you have a report section
      if (document.getElementById('reportBody')) {
        renderDailyTaskReport(currentUser, db);
      }

      // Backup decisions to localStorage
      loadDecisions().then(data => {
        const key = `backup-${new Date().toISOString().slice(0, 10)}`;
        localStorage.setItem(key, JSON.stringify(data));
        console.log('⚡ backup saved to localStorage');
      });
    }
  });

  // Wizard UI initialization
  if (uiRefs.wizardContainer && uiRefs.wizardStep) {
    initWizard(uiRefs);
  }
});

// Expose for debugging
window.loadDecisions = loadDecisions;
