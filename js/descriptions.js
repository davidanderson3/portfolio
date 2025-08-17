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

export async function initDescriptions() {
  const show = getShowDescriptions();
  const panelIds = Array.from(document.querySelectorAll('.tab-button'))
    .map(btn => btn.dataset.target)
    .filter(Boolean);

  let saved = {};
  try {
    const res = await fetch('/api/descriptions');
    if (res.ok) saved = await res.json();
  } catch {}

  panelIds.forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;

    const header = panel.querySelector('.panel-header');
    const container = header?.parentElement || panel;

    const topDesc = document.createElement('textarea');
    topDesc.className = 'tab-description top-description';
    topDesc.value = saved[id]?.top || '';
    if (!show) topDesc.style.display = 'none';
    if (header) {
      header.insertAdjacentElement('afterend', topDesc);
    } else {
      container.prepend(topDesc);
    }
    topDesc.addEventListener('input', () => saveDescription(id, 'top', topDesc.value));

    const bottomDesc = document.createElement('textarea');
    bottomDesc.className = 'tab-description bottom-description';
    bottomDesc.value = saved[id]?.bottom || '';
    if (!show) bottomDesc.style.display = 'none';
    container.appendChild(bottomDesc);
    bottomDesc.addEventListener('input', () => saveDescription(id, 'bottom', bottomDesc.value));
  });
}

async function saveDescription(panelId, position, text) {
  try {
    await fetch('/api/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelId, position, text })
    });
  } catch {}
}
