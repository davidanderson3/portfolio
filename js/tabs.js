import { initMetricsUI } from './stats.js';

export function initTabs(currentUser, db) {
    const tabButtons = document.querySelectorAll('.tab-button');
    const panels = ['goalsPanel', 'calendarPanel', 'dailyPanel', 'metricsPanel'];

    tabButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.dataset.target;
            panels.forEach(id => {
                const el = document.getElementById(id);
                el.style.display = (id === target) ? 'flex' : 'none';
            });

            history.pushState(null, '', `#${target}`);

            if (target === 'dailyPanel') {
                await renderDailyTasks(currentUser, db);
            } else if (target === 'metricsPanel') {
                await initMetricsUI();
            }
        });
    });

    const hash = window.location.hash.substring(1);
    const initial = hash && panels.includes(hash)
        ? hash
        : document.querySelector('.tab-button.active')?.dataset.target || panels[0];

    tabButtons.forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-button[data-target="${initial}"]`)?.classList.add('active');
    panels.forEach(id => {
        const el = document.getElementById(id);
        el.style.display = (id === initial) ? 'flex' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const activeTarget = document.querySelector('.tab-button.active')?.dataset.target;
    if (activeTarget === 'metricsPanel') {
        initMetricsUI();
    }
});
