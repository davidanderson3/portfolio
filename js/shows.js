export async function initShowsPanel() {
  const listEl = document.getElementById('ticketmasterList');
  if (!listEl) return;
  const clientIdInput = document.getElementById('spotifyClientId');
  const clientSecretInput = document.getElementById('spotifyClientSecret');
  const tokenBtn = document.getElementById('spotifyTokenBtn');
  const tokenInput = document.getElementById('spotifyToken');
  const apiKeyInput = document.getElementById('ticketmasterApiKey');
  const loadBtn = document.getElementById('ticketmasterLoadBtn');

  const savedClientId =
    (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyClientId')) || '';
  const savedClientSecret =
    (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyClientSecret')) || '';
  const savedToken =
    (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyToken')) || '';
  const savedApiKey =
    (typeof localStorage !== 'undefined' && localStorage.getItem('ticketmasterApiKey')) || '';
  if (clientIdInput) clientIdInput.value = savedClientId;
  if (clientSecretInput) clientSecretInput.value = savedClientSecret;
  if (tokenInput) tokenInput.value = savedToken;
  if (apiKeyInput) apiKeyInput.value = savedApiKey;

  const fetchToken = async () => {
    const clientId = clientIdInput?.value.trim();
    const clientSecret = clientSecretInput?.value.trim();
    if (!clientId || !clientSecret || !tokenInput) {
      listEl.textContent = 'Please enter Spotify client credentials.';
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spotifyClientId', clientId);
      localStorage.setItem('spotifyClientSecret', clientSecret);
    }
    try {
      listEl.textContent = '';
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      if (!res.ok) throw new Error(`Token HTTP ${res.status}`);
      const data = await res.json();
      tokenInput.value = data.access_token || '';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('spotifyToken', tokenInput.value);
      }
    } catch (err) {
      console.error('Failed to get token', err);
      listEl.textContent = 'Failed to get token.';
    }
  };

  const loadShows = async () => {
    const token = tokenInput?.value.trim();
    const apiKey = apiKeyInput?.value.trim();
    if (!token || !apiKey) {
      listEl.textContent = 'Please enter Spotify token and API key.';
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spotifyToken', token);
      localStorage.setItem('ticketmasterApiKey', apiKey);
    }
    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const artistRes = await fetch('https://api.spotify.com/v1/me/top/artists?limit=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!artistRes.ok) throw new Error(`Spotify HTTP ${artistRes.status}`);
      const artistData = await artistRes.json();
      const artists = artistData.items || [];
      if (artists.length === 0) {
        listEl.textContent = 'No artists found.';
        return;
      }

      const ul = document.createElement('ul');
      for (const artist of artists) {
        const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&keyword=${encodeURIComponent(artist.name)}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const events = data._embedded?.events;
        if (!Array.isArray(events)) continue;
        for (const ev of events) {
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
        }
      }
      listEl.innerHTML = '';
      if (ul.children.length > 0) {
        listEl.appendChild(ul);
      } else {
        listEl.textContent = 'No upcoming shows.';
      }
    } catch (err) {
      console.error('Failed to load shows', err);
      listEl.textContent = 'Failed to load shows.';
    }
  };

  tokenBtn?.addEventListener('click', fetchToken);
  loadBtn?.addEventListener('click', loadShows);

  if (savedToken && savedApiKey) {
    loadShows();
  }
}

window.initShowsPanel = initShowsPanel;

