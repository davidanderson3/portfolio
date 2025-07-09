export function initGoogleCalendar() {
  const connectBtn = document.getElementById('connectCalendarBtn');
  const listEl = document.getElementById('googleEvents');
  if (!connectBtn || !listEl) return;

  connectBtn.disabled = true;

  const API_KEY = 'AIzaSyBbet_bmwm8h8G5CqvmzrdAnc3AO-0IKa8';
  const CLIENT_ID = '727689864651-cb1fvhhbe47usbu6rqmnkjmp9g8sjo6j.apps.googleusercontent.com';
  const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
  const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

  let tokenClient;
  let gapiInited = false;
  let gisInited = false;

  function showEvents(events) {
    listEl.innerHTML = '';
    if (!events || !events.length) {
      listEl.textContent = 'No upcoming events';
      return;
    }
    events.forEach(ev => {
      const li = document.createElement('li');
      const start = ev.start.dateTime || ev.start.date || '';
      li.textContent = `${start.slice(0, 16)} - ${ev.summary}`;
      listEl.appendChild(li);
    });
  }

  async function listUpcomingEvents() {
    try {
      const res = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 10,
        orderBy: 'startTime'
      });
      showEvents(res.result.items);
    } catch (err) {
      console.error('Calendar API error', err);
      listEl.textContent = 'Failed to load events';
    }
  }

  function maybeEnableButton() {
    if (gapiInited && gisInited) {
      connectBtn.disabled = false;
    }
  }

  function handleAuthClick() {
    tokenClient.callback = async (response) => {
      if (response.error) {
        console.error('Token error', response);
        listEl.textContent = 'Failed to authorize';
        return;
      }
      await listUpcomingEvents();
    };

    if (!gapi.client.getToken()) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  function gapiLoaded() {
    gapi.load('client', async () => {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: DISCOVERY_DOCS });
      gapiInited = true;
      maybeEnableButton();
    });
  }

  function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: ''
    });
    gisInited = true;
    maybeEnableButton();
  }

  const scriptGapi = document.createElement('script');
  scriptGapi.src = 'https://apis.google.com/js/api.js';
  scriptGapi.onload = gapiLoaded;
  document.head.appendChild(scriptGapi);

  const scriptGis = document.createElement('script');
  scriptGis.src = 'https://accounts.google.com/gsi/client';
  scriptGis.onload = gisLoaded;
  document.head.appendChild(scriptGis);

  connectBtn.addEventListener('click', handleAuthClick);
}

export async function createCalendarEvent(summary, date, recurrence = '') {
  if (!window.gapi?.client || !gapi.client.getToken()) {
    console.warn('Google Calendar not connected');
    return;
  }
  try {
    const resource = {
      summary,
      start: { date },
      end: { date }
    };
    if (recurrence) {
      let rule = recurrence.trim().toUpperCase();
      if (!rule.startsWith('RRULE:')) {
        if (!rule.startsWith('FREQ=')) {
          rule = `FREQ=${rule}`;
        }
        rule = `RRULE:${rule}`;
      }
      resource.recurrence = [rule];
    }
    await gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource
    });
  } catch (err) {
    console.error('Failed to create calendar event', err);
  }
}
