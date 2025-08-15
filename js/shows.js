export async function initShowsPanel() {
  const listEl = document.getElementById('songkickList');
  if (!listEl) return;
  const userInput = document.getElementById('songkickUsername');
  const keyInput = document.getElementById('songkickApiKey');
  const loadBtn = document.getElementById('songkickLoadBtn');

  const savedUser = localStorage.getItem('songkickUsername') || '';
  const savedKey = localStorage.getItem('songkickApiKey') || '';
  if (userInput) userInput.value = savedUser;
  if (keyInput) keyInput.value = savedKey;

  const loadShows = async () => {
    const username = userInput?.value.trim();
    const apiKey = keyInput?.value.trim();
    if (!username || !apiKey) {
      if (listEl) listEl.textContent = 'Please enter username and API key.';
      return;
    }
    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const url = `https://api.songkick.com/api/3.0/users/${encodeURIComponent(username)}/calendar.json?reason=tracked_artist&apikey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = data?.resultsPage?.results?.event || [];
      if (!Array.isArray(events) || events.length === 0) {
        listEl.textContent = 'No upcoming shows.';
        return;
      }
      const ul = document.createElement('ul');
      events.forEach(ev => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.textContent = `${ev.displayName} - ${ev.start?.date || ''}`;
        if (ev.uri) {
          a.href = ev.uri;
          a.target = '_blank';
        }
        li.appendChild(a);
        ul.appendChild(li);
      });
      listEl.innerHTML = '';
      listEl.appendChild(ul);
      localStorage.setItem('songkickUsername', username);
      localStorage.setItem('songkickApiKey', apiKey);
    } catch (err) {
      console.error('Failed to load Songkick shows', err);
      listEl.textContent = 'Failed to load shows.';
    }
  };

  loadBtn?.addEventListener('click', loadShows);

  if (savedUser && savedKey) {
    loadShows();
  }
}

window.initShowsPanel = initShowsPanel;
