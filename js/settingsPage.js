import { initSettingsPage } from './settings.js';
import { initAuth } from './auth.js';

function initAuthForPage() {
  const uiRefs = {
    logoutBtn: document.getElementById('logoutBtn'),
    bottomLogoutBtn: document.getElementById('bottomLogoutBtn')
  };
  initAuth(uiRefs, () => {});
}

window.addEventListener('DOMContentLoaded', () => {
  initSettingsPage();
  initAuthForPage();
});
