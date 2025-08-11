const DESC_KEY = 'showDescriptions';

export function getShowDescriptions() {
  try {
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(DESC_KEY);
      return value !== 'false';
    }
  } catch {}
  return true;
}

export function setShowDescriptions(show) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DESC_KEY, show ? 'true' : 'false');
    }
  } catch {}
}

export function initDescriptions() {
  const show = getShowDescriptions();
  const panelIds = Array.from(document.querySelectorAll('.tab-button'))
    .map(btn => btn.dataset.target)
    .filter(Boolean);
  panelIds.forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;

    const header = panel.querySelector('.panel-header');
    const container = header?.parentElement || panel;

    const topDesc = document.createElement('textarea');
    topDesc.className = 'tab-description top-description';
    if (!show) topDesc.style.display = 'none';
    if (header) {
      header.insertAdjacentElement('afterend', topDesc);
    } else {
      container.prepend(topDesc);
    }

    const bottomDesc = document.createElement('textarea');
    bottomDesc.className = 'tab-description bottom-description';
    if (!show) bottomDesc.style.display = 'none';
    container.appendChild(bottomDesc);
  });
}
