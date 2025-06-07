// js/main.js
import { initAuth } from './auth.js';
import { initWizard } from './wizard.js';
import { renderGoalsAndSubitems } from './render.js';

export let currentUser = null;

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
    if (user) {
      renderGoalsAndSubitems();
    } else {
      document.getElementById('goalList').innerHTML = '';
      document.getElementById('completedList').innerHTML = '';
    }
  });

  initWizard(uiRefs);
});
