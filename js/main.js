import { loadDecisions, saveDecisions, generateId } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems, initFocusButton, addCalendarGoal } from './goals.js';
import { initAuth, db, currentUser } from './auth.js';
import { initWizard } from './wizard.js';
import { renderDailyTaskReport } from './report.js';
import { initMetricsUI } from './stats.js';
import { initTabs } from './tabs.js';
import { initButtonStyles } from './buttonStyles.js';
import { initTabReports } from './tabReports.js';
import { initGoogleCalendar } from './googleCalendar.js';
import { loadHiddenTabs, applyHiddenTabs } from './settings.js';

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

  document.addEventListener('keydown', e => {
    if (e.key === 'A' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      e.preventDefault();
      handleBottomAdd();
    }
  });

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
    if (cfg.showTextInput) {
      uiRefs.bottomAddText.focus();
    } else {
      const firstRadio = uiRefs.bottomAddOptions.querySelector('input[type="radio"]');
      firstRadio?.focus();
    }
  }

  function handleBottomAdd() {
    const active = document.querySelector('.tab-button.active')?.dataset.target;
    if (!active) return;
    if (active === 'goalsPanel') {
      uiRefs.addGoalBtn?.click();
      return;
    }
    if (active === 'decisionsPanel') {
      window.addDecision?.();
      return;
    }
    if (active === 'calendarPanel') {
      addCalendarGoal();
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
      window.openMetricsConfigForm?.();
      return;
    }
    if (active === 'listsPanel') {
      window.openListsFormModal?.();
      return;
    }
    if (active === 'travelPanel') {
      document.getElementById('addPlaceBtn')?.click();
      return;
    }
  }


  initAuth(uiRefs, async (user) => {
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
