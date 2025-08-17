export async function initShowsPanel() {
  const listEl = document.getElementById('bandsintownList');
  if (!listEl) return;
  const artistInput = document.getElementById('bandsintownArtist');
  const appIdInput = document.getElementById('bandsintownAppId');
  const loadBtn = document.getElementById('bandsintownLoadBtn');

  const savedArtist = localStorage.getItem('bandsintownArtist') || '';
  const savedAppId = localStorage.getItem('bandsintownAppId') || '';
  if (artistInput) artistInput.value = savedArtist;
  if (appIdInput) appIdInput.value = savedAppId;

  const loadShows = async () => {
    const artist = artistInput?.value.trim();
    const appId = appIdInput?.value.trim();
    if (!artist || !appId) {
      if (listEl) listEl.textContent = 'Please enter artist and App ID.';
      return;
    }
    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events?app_id=${appId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const events = await res.json();
      if (!Array.isArray(events) || events.length === 0) {
        listEl.textContent = 'No upcoming shows.';
        return;
      }
      const ul = document.createElement('ul');
      events.forEach(ev => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        const date = ev.datetime ? ev.datetime.split('T')[0] : '';
        a.textContent = `${ev.venue?.name || ''} - ${date}`;
        if (ev.url) {
          a.href = ev.url;
          a.target = '_blank';
        }
        li.appendChild(a);
        ul.appendChild(li);
      });
      listEl.innerHTML = '';
      listEl.appendChild(ul);
      localStorage.setItem('bandsintownArtist', artist);
      localStorage.setItem('bandsintownAppId', appId);
    } catch (err) {
      console.error('Failed to load Bandsintown shows', err);
      listEl.textContent = 'Failed to load shows.';
    }
  };

  loadBtn?.addEventListener('click', loadShows);

  if (savedArtist && savedAppId) {
    loadShows();
  }
}

window.initShowsPanel = initShowsPanel;
