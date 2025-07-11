import { initSettingsPage } from './settings.js';
import { initAuth } from './auth.js';

function initAuthForPage() {
  const uiRefs = {
    logoutBtn: document.getElementById('logoutBtn'),
    bottomLoginBtn: document.getElementById('bottomLoginBtn'),
    bottomLogoutBtn: document.getElementById('bottomLogoutBtn')
  };
  initAuth(uiRefs, () => {});
}

window.addEventListener('DOMContentLoaded', () => {
  initSettingsPage();
  initAuthForPage();
});
