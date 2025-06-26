// File: js/tabs.js
import { renderDailyTasks } from './daily.js';
import { initMetricsUI } from './stats.js';

export function initTabs(currentUser, db) {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', async () => {
            // 1) Toggle active class
            document.querySelectorAll('.tab-button')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 2) Show/hide panels
            const target = btn.dataset.target;
            ['goalsPanel', 'calendarPanel', 'dailyPanel', 'metricsPanel']
                .forEach(id => {
                    const el = document.getElementById(id);
                    el.style.display = (id === target) ? 'flex' : 'none';
                });

            // 3) Load content as needed
            if (target === 'dailyPanel') {
                await renderDailyTasks(currentUser, db);
            }
            else if (target === 'metricsPanel') {
                // initialize and render your stats UI
                await initMetricsUI();
            }
        });
    });
}

// Optionally, if you want the Metrics tab to render on page‐load when active:
document.addEventListener('DOMContentLoaded', () => {
    const active = document.querySelector('.tab-button.active')?.dataset.target;
    if (active === 'metricsPanel') {
        initMetricsUI();
    }
});
