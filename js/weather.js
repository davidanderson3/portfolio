export async function initWeatherPanel() {
  const panel = document.getElementById('weatherPanel');
  if (!panel) return;

  panel.innerHTML = '<div class="full-column">Loading...</div>';

  let coords = null;
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
    panel.innerHTML = '<div class="full-column">Location permission denied.</div>';
    return;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=10&timezone=auto`;
    const resp = await fetch(url);
    const data = await resp.json();
    renderWeather(panel, data);
  } catch (err) {
    console.error('Weather fetch failed', err);
    panel.innerHTML = '<div class="full-column">Failed to fetch weather data.</div>';
  }
}

function renderWeather(panel, data) {
  if (!data) return;

  panel.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'full-column';
  const title = document.createElement('h2');
  title.textContent = 'Weather';
  container.appendChild(title);

  const hourlyTable = document.createElement('table');
  hourlyTable.innerHTML = '<thead><tr><th>Time</th><th>Temp \xB0C</th><th>Rain %</th></tr></thead><tbody></tbody>';
  const hBody = hourlyTable.querySelector('tbody');
  data.hourly.time.slice(0, 24).forEach((t, i) => {
    const tr = document.createElement('tr');
    const time = t.split('T')[1];
    const temp = data.hourly.temperature_2m[i];
    const rain = data.hourly.precipitation_probability ? data.hourly.precipitation_probability[i] : '';
    tr.innerHTML = `<td>${time}</td><td>${temp}</td><td>${rain}</td>`;
    hBody.appendChild(tr);
  });

  const dailyTable = document.createElement('table');
  dailyTable.innerHTML = '<thead><tr><th>Date</th><th>High \xB0C</th><th>Low \xB0C</th><th>Rain %</th></tr></thead><tbody></tbody>';
  const dBody = dailyTable.querySelector('tbody');
  data.daily.time.forEach((date, i) => {
    const tr = document.createElement('tr');
    const high = data.daily.temperature_2m_max[i];
    const low = data.daily.temperature_2m_min[i];
    const rain = data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : '';
    tr.innerHTML = `<td>${date}</td><td>${high}</td><td>${low}</td><td>${rain}</td>`;
    dBody.appendChild(tr);
  });

  container.appendChild(hourlyTable);
  container.appendChild(dailyTable);
  panel.appendChild(container);
}

window.initWeatherPanel = initWeatherPanel;
