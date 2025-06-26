// tabs.js
import { renderDailyTasks } from './daily.js';

export function initTabs(currentUser, db) {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.tab-button')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.dataset.target;
            ['goalsPanel', 'calendarPanel', 'dailyPanel'].forEach(id => {
                const el = document.getElementById(id);
                el.style.display = (id === target) ? 'flex' : 'none';
            });

            if (target === 'dailyPanel') {
                await renderDailyTasks(currentUser, db);
            }
        });
    });
}

// auto‐initialize once the DOM is ready, if currentUser/db are globals
document.addEventListener('DOMContentLoaded', () => {
    // if you have `currentUser` and `db` as globals:
    if (window.currentUser && window.db) {
        initTabs(window.currentUser, window.db);
    }
});
