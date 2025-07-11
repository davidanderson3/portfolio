let tabsInitialized = false;

export function initTabs(currentUser, db) {
  // Only attach listeners once; handlers reference window.currentUser
  if (tabsInitialized) return;
  tabsInitialized = true;

  const tabButtons = document.querySelectorAll('.tab-button');
  const panels    = ['goalsPanel','decisionsPanel','calendarPanel','dailyPanel','metricsPanel','listsPanel','travelPanel'];

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

      // 3) update URL hash
      history.pushState(null, '', `#${target}`);

      // 4) init dynamic content
      if (target === 'dailyPanel') {
        await window.renderDailyTasks(window.currentUser, db);
      }
      else if (target === 'metricsPanel') {
        await window.initMetricsUI();
      }
      else if (target === 'decisionsPanel') {
        await window.initDecisionsPanel();
      }
      else if (target === 'listsPanel') {
        await window.initListsPanel(window.currentUser, db);
      }
      else if (target === 'travelPanel') {
        await window.initTravelPanel();
      }
    });
  });

  // initial activation from hash or default
  const hash    = window.location.hash.substring(1);
  const initial = (hash && panels.includes(hash))
    ? hash
    : document.querySelector('.tab-button.active')?.dataset.target || panels[0];

  tabButtons.forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-button[data-target="${initial}"]`)?.classList.add('active');
  panels.forEach(id => {
    const el = document.getElementById(id);
    el.style.display = (id === initial) ? 'flex' : 'none';
  });

  // on load, fire any needed init. If DOMContentLoaded already fired,
  // run immediately instead of waiting for the event.
  const runInitial = () => {
    if (initial === 'metricsPanel') {
      window.initMetricsUI();
    }
    else if (initial === 'decisionsPanel') {
      window.initDecisionsPanel();
    }
    else if (initial === 'listsPanel') {
      window.initListsPanel(window.currentUser, db);
    }
    else if (initial === 'travelPanel') {
      window.initTravelPanel();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitial);
  } else {
    runInitial();
  }
}
