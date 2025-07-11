import { loadDecisions, saveDecisions, generateId } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems, initFocusButton, addCalendarGoal } from './goals.js';
import { initAuth } from './auth.js';
import { db } from './auth.js';
import { initWizard } from './wizard.js';
import { renderDailyTaskReport } from './report.js';
import { initMetricsUI } from './stats.js';
import { initTabs } from './tabs.js';
import { initButtonStyles } from './buttonStyles.js';
import { initTabReports } from './tabReports.js';
import { initGoogleCalendar } from './googleCalendar.js';
import { loadHiddenTabs, applyHiddenTabs } from './settings.js';

window.currentUser = null;

window.addEventListener('DOMContentLoaded', () => {
  const uiRefs = {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userEmail: document.getElementById('userEmail'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    signupBtn: document.getElementById('signupBtn'),
    splashLoginBtn: document.getElementById('splashLoginBtn'),
    previewBtn: document.getElementById('previewBtn'),
    calendarAddGoalBtn: document.getElementById('calendarAddGoalBtn'),
    addGoalBtn: document.getElementById('addGoalBtn'),
    bottomAddBtn: document.getElementById('bottomAddBtn'),
    bottomLoginBtn: document.getElementById('bottomLoginBtn'),
    bottomLogoutBtn: document.getElementById('bottomLogoutBtn'),
    wizardContainer: document.getElementById('goalWizard'),
    wizardStep: document.getElementById('wizardStep'),
    nextBtn: document.getElementById('wizardNextBtn'),
    backBtn: document.getElementById('wizardBackBtn'),
    cancelBtn: document.getElementById('wizardCancelBtn'),
    focusBtn: document.getElementById('focusBtn')
  };

  const splash = document.getElementById('splash');
  const goalsView = document.getElementById('goalsView');

  uiRefs.signupBtn.addEventListener('click', () => uiRefs.loginBtn.click());
  if (uiRefs.splashLoginBtn) {
    uiRefs.splashLoginBtn.addEventListener('click', () => uiRefs.loginBtn.click());
  }
  if (uiRefs.previewBtn) {
    uiRefs.previewBtn.addEventListener('click', () => {
      splash.style.display = 'none';
      goalsView.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (uiRefs.calendarAddGoalBtn) {
    uiRefs.calendarAddGoalBtn.addEventListener('click', () => addCalendarGoal());
  }

  if (uiRefs.bottomAddBtn) {
    uiRefs.bottomAddBtn.addEventListener('click', () => uiRefs.addGoalBtn?.click());
  }


  initAuth(uiRefs, async (user) => {
    window.currentUser = user;

    ['goalList', 'completedList', 'dailyTasksList', 'weeklyTasksList', 'monthlyTasksList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    window.openGoalIds?.clear?.();

    if (!user) {
      splash.style.display = 'flex';
      goalsView.style.display = '';
      initTabs(null, db);
      const hidden = await loadHiddenTabs();
      applyHiddenTabs(hidden);
      const tabsEl = document.getElementById('tabsContainer');
      if (tabsEl) tabsEl.style.visibility = 'visible';
      renderGoalsAndSubitems();
      renderDailyTasks(null, db);
      initTabReports(null, db);
      return;
    }

    splash.style.display = 'none';
    goalsView.style.display = '';

    initTabs(user, db);
    const hidden = await loadHiddenTabs();
    applyHiddenTabs(hidden);
    const tabsEl = document.getElementById('tabsContainer');
    if (tabsEl) tabsEl.style.visibility = 'visible';
    renderGoalsAndSubitems(user, db);
    renderDailyTasks(user, db);
    initTabReports(user, db);
    if (window.initTravelPanel) {
      try {
        await window.initTravelPanel();
      } catch (err) {
        console.error('Failed to initialize travel panel after sign-in', err);
      }
    }

    if (document.getElementById('reportBody')) {
      renderDailyTaskReport(user, db);
    }

    const backupData = await loadDecisions();
    const backupKey = `backup-${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(backupKey, JSON.stringify(backupData));
  });

  if (uiRefs.wizardContainer && uiRefs.wizardStep) {
    initWizard(uiRefs);
  }

  initFocusButton();

  initButtonStyles();
  initGoogleCalendar();
});

window.renderDailyTasks = renderDailyTasks;
window.initMetricsUI = initMetricsUI;
