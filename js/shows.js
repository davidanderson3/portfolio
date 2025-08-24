const API_BASE_URL =
  (typeof window !== 'undefined' && window.apiBaseUrl) ||
  (typeof process !== 'undefined' && process.env.API_BASE_URL) ||
  'https://dashboard-6aih.onrender.com';

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

  const savedClientId =
    (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyClientId')) || '';
  if (clientIdInput) clientIdInput.value = savedClientId;

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
        const accessToken = data.access_token || '';
        if (tokenInput) tokenInput.value = '';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('spotifyToken', accessToken);
        }
      }
    } catch (err) {
      console.error('Failed to exchange code', err);
    } finally {
      window.history.replaceState({}, '', redirectUri);
    }
  }

  const loadShows = async () => {
    const token =
      tokenInput?.value.trim() ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('spotifyToken')) || '';
    const apiKey =
      apiKeyInput?.value.trim() ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('ticketmasterApiKey')) || '';
    if (!token || !apiKey) {
      listEl.textContent = 'Please enter Spotify token and API key.';
      return;
    }
    if (tokenInput?.value && typeof localStorage !== 'undefined') {
      localStorage.setItem('spotifyToken', token);
    }
    if (apiKeyInput?.value && typeof localStorage !== 'undefined') {
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
         const url =
           `${API_BASE_URL}/api/ticketmaster?apikey=${apiKey}&keyword=${encodeURIComponent(
             artist.name
           )}`;
         const res = await fetch(url);
         if (!res.ok) continue;
         const data = await res.json();
         const events = data._embedded?.events;
         if (!Array.isArray(events)) continue;
         for (const ev of events) {
           const li = document.createElement('li');
           const nameDiv = document.createElement('div');
           nameDiv.textContent = ev.name || 'Unnamed event';
           li.appendChild(nameDiv);
           const venue = ev._embedded?.venues?.[0];
           const locParts = [venue?.name, venue?.city?.name, venue?.state?.stateCode].filter(Boolean);
           if (locParts.length > 0) {
             const locDiv = document.createElement('div');
             locDiv.textContent = locParts.join(' - ');
             li.appendChild(locDiv);
           }
           const date = ev.dates?.start?.localDate;
           if (date) {
             const dateDiv = document.createElement('div');
             dateDiv.textContent = date;
             li.appendChild(dateDiv);
           }
           if (ev.url) {
             const link = document.createElement('a');
             link.href = ev.url;
             link.target = '_blank';
             link.rel = 'noopener noreferrer';
             link.textContent = 'View Event';
             li.appendChild(link);
           }
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

  await loadShows();
}

window.initShowsPanel = initShowsPanel;

