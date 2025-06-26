// main.js

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
  // 1) UI references
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

  // 2) Splash vs App containers
  const splash = document.getElementById('splash');
  const signupBtn = document.getElementById('signupBtn');
  const goalsView = document.getElementById('goalsView');

  // “Sign Up” just triggers the same auth
  signupBtn.addEventListener('click', () => uiRefs.loginBtn.click());

  // 3) Initialize auth (shows splash or app)
  initAuth(uiRefs, async (user) => {
    currentUser = user;
    window.currentUser = user;

    if (!user) {
      // signed out → show splash, hide app
      splash.style.display = 'flex';
      goalsView.style.display = 'none';
      return;
    }

    // signed in → hide splash, show app
    splash.style.display = 'none';
    goalsView.style.display = '';

    // clear out any old content
    ['goalList', 'completedList', 'dailyTasksList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    window.openGoalIds?.clear?.();

    // wire up tabs and render default panels
    initTabs(currentUser, db);
    renderGoalsAndSubitems(currentUser, db);

    if (document.getElementById('reportBody')) {
      renderDailyTaskReport(currentUser, db);
    }

    // backup decisions
    const data = await loadDecisions();
    localStorage.setItem(
      `backup-${new Date().toISOString().slice(0, 10)}`,
      JSON.stringify(data)
    );
    console.log('⚡ backup saved to localStorage');
  });

  // 4) Wizard initialization
  if (uiRefs.wizardContainer && uiRefs.wizardStep) {
    initWizard(uiRefs);
  }
});

// for debugging
window.loadDecisions = loadDecisions;
