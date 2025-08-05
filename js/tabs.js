import { currentUser } from './auth.js';

export const PANELS = [
  'dailyPanel',
  'projectsPanel',
  'calendarPanel',
  'metricsPanel',
  'listsPanel',
  'travelPanel',
  'planningPanel',
  'budgetPanel',
  'contactsPanel'
];

export const PANEL_NAMES = {
  projectsPanel: 'Projects',
  calendarPanel: 'Calendar',
  dailyPanel: 'Routine',
  metricsPanel: 'Metrics',
  listsPanel: 'Lists',
  travelPanel: 'Places',
  planningPanel: 'Planning',
  budgetPanel: 'Budget',
  contactsPanel: 'Contacts'
};

let tabsInitialized = false;

export function initTabs(user, db) {
  // Only attach listeners once; handlers reference the shared currentUser
  if (tabsInitialized) return;
  tabsInitialized = true;

  const LAST_PANEL_KEY = 'lastPanel';

  const tabButtons = document.querySelectorAll('.tab-button');
  const panels    = PANELS;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      // 1) toggle active state
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 2) show/hide panels
      const target = btn.dataset.target;
      panels.forEach(id => {
        const el = document.getElementById(id);
        el.style.display = (id === target) ? 'flex' : 'none';
      });

      // Remember selected panel
      try { localStorage.setItem(LAST_PANEL_KEY, target); } catch {}

      // 3) update URL hash
      history.pushState(null, '', `#${target}`);

      // 4) init dynamic content
      if (target === 'dailyPanel') {
        await window.renderDailyTasks(currentUser, db);
      }
      else if (target === 'metricsPanel') {
        await window.initMetricsUI();
      }
      else if (target === 'listsPanel') {
        await window.initListsPanel(currentUser, db);
      }
      else if (target === 'travelPanel') {
        await window.initTravelPanel();
      }
      else if (target === 'planningPanel') {
        await window.initPlanningPanel();
      }
      else if (target === 'budgetPanel') {
        await window.initBudgetPanel();
      }
    });
  });

  // initial activation from hash or default
  const hash    = window.location.hash.substring(1);
  let saved     = null;
  try { saved = localStorage.getItem(LAST_PANEL_KEY); } catch {}
  const initial = (hash && panels.includes(hash))
    ? hash
    : (saved && panels.includes(saved))
      ? saved
      : document.querySelector('.tab-button.active')?.dataset.target || panels[0];

  tabButtons.forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-button[data-target="${initial}"]`)?.classList.add('active');
  panels.forEach(id => {
    const el = document.getElementById(id);
    el.style.display = (id === initial) ? 'flex' : 'none';
  });

  try { localStorage.setItem(LAST_PANEL_KEY, initial); } catch {}

  // on load, fire any needed init. If DOMContentLoaded already fired,
  // run immediately instead of waiting for the event.
  const runInitial = () => {
    if (initial === 'metricsPanel') {
      window.initMetricsUI();
    }
    else if (initial === 'listsPanel') {
      window.initListsPanel(currentUser, db);
    }
    else if (initial === 'travelPanel') {
      window.initTravelPanel();
    }
    else if (initial === 'planningPanel') {
      window.initPlanningPanel();
    }
    else if (initial === 'budgetPanel') {
      window.initBudgetPanel();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitial);
  } else {
    runInitial();
  }
}
