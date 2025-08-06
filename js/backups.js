import { restoreBackup } from './helpers.js';

export function initBackupsPanel() {
  const panel = document.getElementById('backupsPanel');
  if (!panel) return;
  const list = panel.querySelector('#backupList');
  if (!list) return;
  list.innerHTML = '';
  const backups = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('backup-')) backups.push(key);
  }
  if (backups.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No backups found';
    list.appendChild(li);
    return;
  }
  backups.sort();
  backups.forEach(key => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = 'Restore';
    btn.addEventListener('click', async () => {
      const restored = await restoreBackup(() => key);
      if (restored) {
        alert(`Restored ${key}`);
        initBackupsPanel();
      }
    });
    li.textContent = key + ' ';
    li.appendChild(btn);
    list.appendChild(li);
  });
}

if (typeof window !== 'undefined') {
  window.initBackupsPanel = initBackupsPanel;
}
