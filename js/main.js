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
    bottomAddModal: document.getElementById('bottomAddModal'),
    bottomAddTitle: document.getElementById('bottomAddTitle'),
    bottomAddOptions: document.getElementById('bottomAddOptions'),
    bottomAddText: document.getElementById('bottomAddText'),
    bottomAddCancel: document.getElementById('bottomAddCancel'),
    bottomAddSubmit: document.getElementById('bottomAddSubmit'),
    wizardContainer: document.getElementById('goalWizardModal'),
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
    uiRefs.bottomAddBtn.addEventListener('click', handleBottomAdd);
  }

  function showAddModal(cfg) {
    if (!uiRefs.bottomAddModal) return;
    uiRefs.bottomAddTitle.textContent = cfg.title || 'Add';
    uiRefs.bottomAddOptions.innerHTML = '';
    cfg.options.forEach(opt => {
      const label = document.createElement('label');
      label.style.marginRight = '8px';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'bottomAddOption';
      radio.value = opt.value;
      label.append(radio, document.createTextNode(' ' + opt.label));
      uiRefs.bottomAddOptions.append(label);
    });
    uiRefs.bottomAddText.style.display = cfg.showTextInput ? 'block' : 'none';
    uiRefs.bottomAddText.value = '';

    function close() {
      uiRefs.bottomAddModal.style.display = 'none';
      uiRefs.bottomAddSubmit.onclick = null;
      uiRefs.bottomAddCancel.onclick = null;
    }

    uiRefs.bottomAddCancel.onclick = close;
    uiRefs.bottomAddSubmit.onclick = () => {
      const selected = uiRefs.bottomAddOptions.querySelector('input[name="bottomAddOption"]:checked')?.value;
      const text = uiRefs.bottomAddText.value.trim();
      close();
      if (cfg.onSubmit) cfg.onSubmit({ option: selected, text });
    };

    uiRefs.bottomAddModal.style.display = 'flex';
  }

  function handleBottomAdd() {
    const active = document.querySelector('.tab-button.active')?.dataset.target;
    if (!active) return;
    if (active === 'goalsPanel') {
      uiRefs.addGoalBtn?.click();
      return;
    }
    if (active === 'dailyPanel') {
      showAddModal({
        title: 'Add Task',
        options: [
          { label: 'Daily', value: 'daily' },
          { label: 'Weekly', value: 'weekly' },
          { label: 'Monthly', value: 'monthly' }
        ],
        showTextInput: true,
        onSubmit({ option, text }) {
          if (option && text) window.quickAddTask?.(option, text);
        }
      });
      return;
    }
    if (active === 'metricsPanel') {
      document.getElementById('showConfigBtn')?.click();
      return;
    }
    if (active === 'listsPanel') {
      showAddModal({
        title: 'Add to Lists',
        options: [
          { label: 'List', value: 'list' },
          { label: 'Item', value: 'item' },
          { label: 'Column', value: 'column' }
        ],
        onSubmit({ option }) {
          if (option === 'list') {
            document.getElementById('createListBtn')?.click();
          } else if (option === 'column') {
            document.getElementById('addColumnBtn')?.click();
            document.getElementById('addColumnToListBtn')?.click();
          } else if (option === 'item') {
            document.querySelector('#itemForm .add-item-btn')?.click();
          }
        }
      });
      return;
    }
    if (active === 'travelPanel') {
      document.getElementById('addPlaceBtn')?.click();
      return;
    }
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
