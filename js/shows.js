function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let str = '';
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } else {
    const { createHash } = await import('crypto');
    return createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

export async function initShowsPanel() {
  const listEl = document.getElementById('ticketmasterList');
  if (!listEl) return;
  const clientIdInput = document.getElementById('spotifyClientId');
  const tokenBtn = document.getElementById('spotifyTokenBtn');
  const tokenInput = document.getElementById('spotifyToken');
  const apiKeyInput = document.getElementById('ticketmasterApiKey');
  const loadBtn = document.getElementById('ticketmasterLoadBtn');

  const savedClientId =
    (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyClientId')) || '';
  const savedToken =
    (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyToken')) || '';
  const savedApiKey =
    (typeof localStorage !== 'undefined' && localStorage.getItem('ticketmasterApiKey')) || '';
  if (clientIdInput) clientIdInput.value = savedClientId;
  if (tokenInput) tokenInput.value = savedToken;
  if (apiKeyInput) apiKeyInput.value = savedApiKey;

  const redirectUri = window.location.origin + window.location.pathname;

  const startAuth = async () => {
    const clientId = clientIdInput?.value.trim();
    if (!clientId) {
      listEl.textContent = 'Please enter Spotify client ID.';
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spotifyClientId', clientId);
    }
    const verifier = randomString(64);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spotifyCodeVerifier', verifier);
    }
    const challenge = await pkceChallenge(verifier);
    const authUrl =
      'https://accounts.spotify.com/authorize' +
      `?response_type=code&client_id=${encodeURIComponent(clientId)}` +
      `&scope=${encodeURIComponent('user-top-read')}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      '&code_challenge_method=S256' +
      `&code_challenge=${challenge}`;
    if (!window.__NO_SPOTIFY_REDIRECT) {
      try {
        window.location.href = authUrl;
      } catch (e) {
        // jsdom doesn't implement navigation; ignore
      }
    }
  };

  const params = new URLSearchParams(window.location.search);
  const authCode = params.get('code');
  if (authCode && savedClientId && tokenInput) {
    try {
      const verifier =
        (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyCodeVerifier')) || '';
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri,
        client_id: savedClientId,
        code_verifier: verifier
      });
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (res.ok) {
        const data = await res.json();
        tokenInput.value = data.access_token || '';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('spotifyToken', tokenInput.value);
        }
      }
    } catch (err) {
      console.error('Failed to exchange code', err);
    } finally {
      window.history.replaceState({}, '', redirectUri);
    }
  }

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

  tokenBtn?.addEventListener('click', startAuth);
  loadBtn?.addEventListener('click', loadShows);

  if (savedToken && savedApiKey) {
    loadShows();
  }
}

window.initShowsPanel = initShowsPanel;

