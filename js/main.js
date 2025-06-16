import { loadDecisions, saveDecisions, generateId } from './helpers.js';
import { renderDailyTasks } from './daily.js';
import { renderGoalsAndSubitems } from './render.js';
import { initAuth } from './auth.js';
import { db } from './auth.js';
import { showDailyLogPrompt } from './dailyLog.js';
import { initWizard } from './wizard.js';


let currentUser = null;
window.currentUser = null;

window.addEventListener('DOMContentLoaded', () => {
  const uiRefs = {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userEmail: document.getElementById('userEmail'),
    addGoalBtn: document.getElementById('addGoalBtn'),
    wizardContainer: document.getElementById('goalWizard'),
    wizardStep: document.getElementById('wizardStep'),
    nextBtn: document.getElementById('wizardNextBtn'),
    backBtn: document.getElementById('wizardBackBtn'),
    cancelBtn: document.getElementById('wizardCancelBtn'),
  };

  initAuth(uiRefs, (user) => {
    currentUser = user;
    window.currentUser = user;


    if (user) {
      document.getElementById('goalList').innerHTML = '';
      document.getElementById('completedList').innerHTML = '';
      const dailyList = document.getElementById('dailyTasksList');
      if (dailyList) dailyList.innerHTML = '';

      if (window.openGoalIds) window.openGoalIds.clear?.();

      // ✅ Move daily tasks render first
      renderDailyTasks(user, db).then(() => {
        // Optionally defer these to next tick
        renderGoalsAndSubitems(user, db);
        showDailyLogPrompt(user, db);
      });
    }
    else {
      document.getElementById('goalList').innerHTML = '';
      document.getElementById('completedList').innerHTML = '';
      const dailyList = document.getElementById('dailyTasksList');
      if (dailyList) dailyList.innerHTML = '';
    }
  });

  initWizard(uiRefs);
});
