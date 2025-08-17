export async function initShowsPanel() {
  const listEl = document.getElementById('ticketmasterList');
  if (!listEl) return;
  const keywordInput = document.getElementById('ticketmasterKeyword');
  const apiKeyInput = document.getElementById('ticketmasterApiKey');
  const loadBtn = document.getElementById('ticketmasterLoadBtn');

  const savedKeyword = localStorage.getItem('ticketmasterKeyword') || '';
  const savedApiKey = localStorage.getItem('ticketmasterApiKey') || '';
  if (keywordInput) keywordInput.value = savedKeyword;
  if (apiKeyInput) apiKeyInput.value = savedApiKey;

  const loadShows = async () => {
    const keyword = keywordInput?.value.trim();
    const apiKey = apiKeyInput?.value.trim();
    if (!keyword || !apiKey) {
      if (listEl) listEl.textContent = 'Please enter keyword and API key.';
      return;
    }
    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&keyword=${encodeURIComponent(keyword)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = data._embedded?.events;
      if (!Array.isArray(events) || events.length === 0) {
        listEl.textContent = 'No upcoming shows.';
        return;
      }
      const ul = document.createElement('ul');
      events.forEach(ev => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        const date = ev.dates?.start?.localDate || '';
        const venue = ev._embedded?.venues?.[0];
        const venueName = venue?.name || '';
        const city = venue?.city?.name || '';
        const state = venue?.state?.stateCode || venue?.state?.name || '';
        const location = [city, state].filter(Boolean).join(', ');
        a.textContent = `${ev.name || ''} - ${location} - ${date} - ${venueName}`;
        if (ev.url) {
          a.href = ev.url;
          a.target = '_blank';
        }
        li.appendChild(a);
        ul.appendChild(li);
      });
      listEl.innerHTML = '';
      listEl.appendChild(ul);
      localStorage.setItem('ticketmasterKeyword', keyword);
      localStorage.setItem('ticketmasterApiKey', apiKey);
    } catch (err) {
      console.error('Failed to load Ticketmaster shows', err);
      listEl.textContent = 'Failed to load shows.';
    }
  };

  loadBtn?.addEventListener('click', loadShows);

  if (savedKeyword && savedApiKey) {
    loadShows();
  }
}

window.initShowsPanel = initShowsPanel;
