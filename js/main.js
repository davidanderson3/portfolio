import { loadDecisions, flushPendingDecisions, clearDecisionsCache } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems, addCalendarGoal } from './goals.js';
import { initAuth, db, currentUser } from './auth.js';
import { initWizard } from './wizard.js';
import { renderDailyTaskReport } from './report.js';
import { initMetricsUI } from './stats.js';
import { initTabs } from './tabs.js';
import { initButtonStyles } from './buttonStyles.js';
import { initTabReports } from './tabReports.js';
import { initGoogleCalendar } from './googleCalendar.js';
import { loadHiddenTabs, applyHiddenTabs, saveHiddenTabs } from './settings.js';
import { clearPlanningCache } from './planning.js';

let hiddenTabsTimer = null;
let renderQueue = Promise.resolve();

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
    calendarAddProjectBtn: document.getElementById('calendarAddProjectBtn'),
    addProjectBtn: document.getElementById('addProjectBtn'),
    bottomAddBtn: document.getElementById('bottomAddBtn'),
    bottomLogoutBtn: document.getElementById('bottomLogoutBtn'),
    bottomAddModal: document.getElementById('bottomAddModal'),
    bottomAddTitle: document.getElementById('bottomAddTitle'),
    bottomAddOptions: document.getElementById('bottomAddOptions'),
    bottomAddText: document.getElementById('bottomAddText'),
    bottomAddCancel: document.getElementById('bottomAddCancel'),
    bottomAddSubmit: document.getElementById('bottomAddSubmit'),
    wizardContainer: document.getElementById('projectWizardModal'),
    wizardStep: document.getElementById('wizardStep'),
    nextBtn: document.getElementById('wizardNextBtn'),
    backBtn: document.getElementById('wizardBackBtn'),
    cancelBtn: document.getElementById('wizardCancelBtn')
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

  if (uiRefs.calendarAddProjectBtn) {
    uiRefs.calendarAddProjectBtn.addEventListener('click', () => addCalendarGoal());
  }

  if (uiRefs.bottomAddBtn) {
    uiRefs.bottomAddBtn.addEventListener('click', handleBottomAdd);
  }
  document.querySelectorAll('.tab-hide-btn').forEach(btn => {
    setupHideTabButton(btn);
  });

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
    if (active === 'projectsPanel') {
      uiRefs.addProjectBtn?.click();
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
    if (active === 'contactsPanel') {
      showAddModal({
        title: 'Add Contact',
        options: [],
        showTextInput: true,
        onSubmit({ text }) {
          if (text) window.addContact?.(text);
        }
      });
      return;
    }
  }

  function setupHideTabButton(btn) {
    const menu = document.createElement('div');
    Object.assign(menu.style, {
      position: 'absolute',
      background: '#fff',
      border: '1px solid #ccc',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      zIndex: 9999,
      minWidth: '120px',
      display: 'none'
    });
    document.body.appendChild(menu);

    const options = [
      { label: '1 hour', value: 1 },
      { label: '2 hours', value: 2 },
      { label: '4 hours', value: 4 },
      { label: '6 hours', value: 6 },
      { label: '8 hours', value: 8 },
      { label: '10 hours', value: 10 },
      { label: '12 hours', value: 12 },
      { label: '14 hours', value: 14 },
      { label: '20 hours', value: 20 },
      { label: '1 day', value: 24 },
      { label: '2 days', value: 48 },
      { label: '3 days', value: 72 },
      { label: '4 days', value: 96 },
      { label: '1 week', value: 168 },
      { label: '2 weeks', value: 336 },
      { label: '1 month', value: 720 },
      { label: '2 months', value: 1440 },
      { label: '3 months', value: 2160 }
    ];

    options.forEach(opt => {
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.textContent = opt.label;
      optBtn.classList.add('postpone-option');
      optBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const active = document.querySelector('.tab-button.active')?.dataset.target;
        if (!active) return;
        const hidden = await loadHiddenTabs();
        hidden[active] = new Date(Date.now() + opt.value * 3600 * 1000).toISOString();
        await saveHiddenTabs(hidden);
        applyHiddenTabs(hidden);
        menu.style.display = 'none';
      });
      menu.appendChild(optBtn);
    });

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (menu.style.display === 'block') {
        menu.style.display = 'none';
        return;
      }
      menu.style.display = 'block';
      const rect = btn.getBoundingClientRect();
      const menuHeight = menu.offsetHeight;
      let top = rect.top - menuHeight + window.scrollY;
      const viewportTop = window.scrollY;
      if (top < viewportTop) {
        top = rect.bottom + window.scrollY;
      }
      const viewportBottom = window.scrollY + window.innerHeight;
      if (top + menuHeight > viewportBottom) {
        top = viewportBottom - menuHeight;
        if (top < viewportTop) top = viewportTop;
      }
      menu.style.top = `${top}px`;
      let left = rect.left + window.scrollX;
      if (left + menu.offsetWidth > window.innerWidth) {
        left = window.innerWidth - menu.offsetWidth - 10;
        if (left < 0) left = 0;
      }
      menu.style.left = `${left}px`;
    });

    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.style.display = 'none';
      }
    });
  }

  function initCalendarMobileTabs() {
    const panel = document.getElementById('calendarPanel');
    const dailyBtn = document.getElementById('calendarDailyTab');
    const hourlyBtn = document.getElementById('calendarHourlyTab');
    if (!panel || !dailyBtn || !hourlyBtn) return;

    const setView = view => {
      panel.classList.toggle('mobile-daily', view === 'daily');
      panel.classList.toggle('mobile-hourly', view === 'hourly');
      dailyBtn.classList.toggle('active', view === 'daily');
      hourlyBtn.classList.toggle('active', view === 'hourly');
    };

    dailyBtn.addEventListener('click', () => setView('daily'));
    hourlyBtn.addEventListener('click', () => setView('hourly'));
    setView('daily');
  }

  function clearTaskLists() {
    ['goalList', 'completedList', 'dailyTasksList', 'weeklyTasksList', 'monthlyTasksList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  }

  // Clear any stale content immediately to avoid flashing old tasks on mobile
  clearTaskLists();

  // Re-render UI components whenever decisions are updated
  window.addEventListener('decisionsUpdated', () => {
    renderQueue = renderQueue.then(() => renderGoalsAndSubitems());
    if (document.querySelector('.tab-button.active')?.dataset.target === 'dailyPanel') {
      renderDailyTasks(currentUser, db);
    }
    initTabReports(currentUser, db);
    if (document.getElementById('reportBody')) {
      renderDailyTaskReport(currentUser, db);
    }
  });

    initAuth(uiRefs, async (user) => {

      clearTaskLists();
      clearDecisionsCache();

      window.openGoalIds?.clear?.();

      if (!user) {
        clearPlanningCache();
        if (splash) splash.style.display = 'flex';
        if (goalsView) goalsView.style.display = '';
        initTabs(null, db);
      const hidden = await loadHiddenTabs();
      applyHiddenTabs(hidden);
      if (hiddenTabsTimer) clearInterval(hiddenTabsTimer);
      hiddenTabsTimer = setInterval(async () => {
        const h = await loadHiddenTabs();
        applyHiddenTabs(h);
      }, 60 * 1000);
      const tabsEl = document.getElementById('tabsContainer');
        if (tabsEl) tabsEl.style.visibility = 'visible';
        renderGoalsAndSubitems();
        if (document.querySelector('.tab-button.active')?.dataset.target === 'dailyPanel') {
          renderDailyTasks(null, db);
        }
        initTabReports(null, db);
        return;
      }

      if (splash) splash.style.display = 'none';
      if (goalsView) goalsView.style.display = '';

      clearPlanningCache();

      initTabs(user, db);
      const hidden = await loadHiddenTabs();
      applyHiddenTabs(hidden);
      if (hiddenTabsTimer) clearInterval(hiddenTabsTimer);
      hiddenTabsTimer = setInterval(async () => {
        const h = await loadHiddenTabs();
        applyHiddenTabs(h);
      }, 60 * 1000);
      await loadDecisions(true);
      const tabsEl = document.getElementById('tabsContainer');
      if (tabsEl) tabsEl.style.visibility = 'visible';
      if (window.initTravelPanel) {
        try {
          await window.initTravelPanel();
        } catch (err) {
          console.error('Failed to initialize travel panel after sign-in', err);
      }
    }
    if (window.initWeatherPanel) {
      try {
        await window.initWeatherPanel();
      } catch (err) {
        console.error('Failed to initialize weather panel after sign-in', err);
      }
    }
      if (window.initPlanningPanel) {
        try {
          await window.initPlanningPanel();
        } catch (err) {
          console.error('Failed to initialize planning panel after sign-in', err);
        }
      }

      const backupData = await loadDecisions();
      const backupKey = `backup-${new Date().toISOString().slice(0, 10)}`;
      localStorage.setItem(backupKey, JSON.stringify(backupData));
    });

  if (uiRefs.wizardContainer && uiRefs.wizardStep) {
    initWizard(uiRefs);
  }

  initCalendarMobileTabs();
  initButtonStyles();
  initGoogleCalendar();

  // Persist any unsaved decisions when the page is hidden or closed
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingDecisions().catch(() => {});
    }
  });
  window.addEventListener('beforeunload', async () => {
    try {
      await flushPendingDecisions();
    } catch {
      // ignore errors during unload
    }
  });
});

window.renderDailyTasks = renderDailyTasks;
window.initMetricsUI = initMetricsUI;
