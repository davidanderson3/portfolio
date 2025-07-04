export function initGoogleCalendar() {
  const connectBtn = document.getElementById('connectCalendarBtn');
  const listEl = document.getElementById('googleEvents');
  if (!connectBtn || !listEl) return;

  function loadGapi() {
    return new Promise((resolve, reject) => {
      if (window.gapi) return resolve(window.gapi);
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve(window.gapi);
      script.onerror = () => reject(new Error('Failed to load gapi'));
      document.head.appendChild(script);
    });
  }

  const API_KEY = 'AIzaSyBbet_bmwm8h8G5CqvmzrdAnc3AO-0IKa8';
  const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
  const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

  function showEvents(events) {
    listEl.innerHTML = '';
    if (!events || !events.length) {
      listEl.textContent = 'No upcoming events';
      return;
    }
    events.forEach(ev => {
      const li = document.createElement('li');
      const start = ev.start.dateTime || ev.start.date || '';
      li.textContent = `${start.slice(0,16)} - ${ev.summary}`;
      listEl.appendChild(li);
    });
  }

  function listUpcomingEvents() {
    gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 10,
      orderBy: 'startTime'
    }).then(res => {
      showEvents(res.result.items);
    }, err => {
      console.error('Calendar API error', err);
      listEl.textContent = 'Failed to load events';
    });
  }

  connectBtn.addEventListener('click', () => {
    loadGapi()
      .then(() => {
        gapi.load('client:auth2', () => {
          gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
          })
            .then(() => gapi.auth2.getAuthInstance().signIn())
            .then(listUpcomingEvents)
            .catch(err => {
              console.error('Auth or API error', err);
              listEl.textContent = 'Unable to connect to Google Calendar';
            });
        });
      })
      .catch(err => {
        console.error(err);
        listEl.textContent = 'Unable to load Google API';
      });
  });
}
