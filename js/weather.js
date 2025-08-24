const DEFAULT_LAT = 37.7749;
const DEFAULT_LON = -122.4194;

function chooseWeatherIcon(rain) {
  if (rain === undefined || rain === null) return '☀️';
  if (rain < 20) return '☀️';
  if (rain < 50) return '🌤️';
  if (rain < 80) return '🌧️';
  return '⛈️';
}

async function fetchWeatherData() {
  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;
  try {
    if (navigator.geolocation) {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000
        });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    }
  } catch (err) {
    console.warn('Geolocation failed or denied, using default location');
  }

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'temperature_2m,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: 'fahrenheit',
    timezone: 'auto'
  });

  try {
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    const data = await resp.json();
    return { data };
  } catch (err) {
    console.error('Failed to fetch weather', err);
    return null;
  }
}

window.fetchWeatherData = fetchWeatherData;
window.chooseWeatherIcon = chooseWeatherIcon;
