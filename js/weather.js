export async function initWeatherPanel() {
  const panel = document.getElementById('weatherPanel');
  if (!panel) return;

  panel.innerHTML = '<div class="full-column">Loading...</div>';

  let coords = null;
  let usingDefault = false;
  if (navigator.geolocation) {
    try {
      coords = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 5000 }
        );
      });
    } catch {
      coords = null;
    }
  }

  if (!coords) {
    // fallback to a default location (San Francisco) if permission denied
    coords = { lat: 37.7749, lon: -122.4194 };
    usingDefault = true;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=10&timezone=auto&temperature_unit=fahrenheit`;
    const resp = await fetch(url);
    const data = await resp.json();
    renderWeather(panel, data, usingDefault);
  } catch (err) {
    console.error('Weather fetch failed', err);
    panel.innerHTML = '<div class="full-column">Failed to fetch weather data.</div>';
  }
}

function renderWeather(panel, data, usingDefault) {
  if (!data) return;

  panel.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'full-column';
  const title = document.createElement('h2');
  title.textContent = 'Weather';
  container.appendChild(title);
  if (usingDefault) {
    const note = document.createElement('div');
    note.textContent = 'Location unavailable; showing San Francisco weather.';
    note.style.fontStyle = 'italic';
    container.appendChild(note);
  }

  const hourlyTable = document.createElement('table');
  hourlyTable.innerHTML = '<thead><tr><th>Time</th><th>Temp \xB0F</th><th>Rain %</th></tr></thead><tbody></tbody>';
  const hBody = hourlyTable.querySelector('tbody');

  const now = new Date();
  const startIdx = data.hourly.time.findIndex(t => new Date(t) >= now);
  const begin = startIdx === -1 ? 0 : startIdx;
  for (let i = begin; i < Math.min(data.hourly.time.length, begin + 24); i++) {
    const t = data.hourly.time[i];
    const tr = document.createElement('tr');
    const time = new Date(t).toLocaleTimeString([], { hour: 'numeric', hour12: true });
    const temp = data.hourly.temperature_2m[i];
    const rain = data.hourly.precipitation_probability ? data.hourly.precipitation_probability[i] : '';
    tr.innerHTML = `<td>${time}</td><td>${temp}</td><td>${rain}</td>`;
    hBody.appendChild(tr);
  }

  const dailyTable = document.createElement('table');
  dailyTable.innerHTML = '<thead><tr><th>Day</th><th>High \xB0F</th><th>Low \xB0F</th><th>Rain %</th></tr></thead><tbody></tbody>';
  const dBody = dailyTable.querySelector('tbody');
  data.daily.time.forEach((dateStr, i) => {
    const tr = document.createElement('tr');
    const day = new Date(dateStr).toLocaleDateString([], { weekday: 'short' });
    const high = data.daily.temperature_2m_max[i];
    const low = data.daily.temperature_2m_min[i];
    const rain = data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : '';
    tr.innerHTML = `<td>${day}</td><td>${high}</td><td>${low}</td><td>${rain}</td>`;
    dBody.appendChild(tr);
  });

  container.appendChild(hourlyTable);
  container.appendChild(dailyTable);
  panel.appendChild(container);
}

window.initWeatherPanel = initWeatherPanel;
