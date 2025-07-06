import { db } from './auth.js';

let mapInitialized = false;
let map;
let travelData = [];

export async function initTravelPanel() {
  const panel = document.getElementById('travelPanel');
  if (!panel || mapInitialized) return;
  mapInitialized = true;

  const mapEl = document.getElementById('travelMap');
  const list = document.getElementById('travelList');
  map = L.map(mapEl).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  try {
    const snap = await db.collection('travel').get();
    travelData = snap.docs.map(doc => doc.data());
    if (!travelData.length) {
      throw new Error('No travel docs');
    }
    localStorage.setItem('travelData', JSON.stringify(travelData));
  } catch (err) {
    console.error('Failed to load travel data', err);
    const cached = localStorage.getItem('travelData');
    travelData = cached ? JSON.parse(cached) : [];
  }

  const addMarker = (p) => {
    L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
  };

  list.innerHTML = '';
  travelData.forEach(p => {
    addMarker(p);
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})`;
    list.append(li);
  });

  document.getElementById('addPlaceBtn').addEventListener('click', async () => {
    const name = prompt('Place name:');
    const lat = parseFloat(prompt('Latitude:'));
    const lon = parseFloat(prompt('Longitude:'));
    if (!name || Number.isNaN(lat) || Number.isNaN(lon)) return;
    const place = { name, lat, lon };
    travelData.push(place);
    localStorage.setItem('travelData', JSON.stringify(travelData));
    try {
      await db.collection('travel').add(place);
    } catch (err) {
      console.error('Failed to save place to Firestore', err);
    }
    addMarker(place);
    const li = document.createElement('li');
    li.textContent = `${place.name} (${place.lat.toFixed(4)}, ${place.lon.toFixed(4)})`;
    list.append(li);
  });
}

// legacy parser kept for potential future imports
export function parseKml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const placemarks = Array.from(doc.querySelectorAll('Placemark'));
  return placemarks.map(pm => {
    const name = pm.querySelector('name')?.textContent || 'Unknown';
    const coords = pm.querySelector('coordinates')?.textContent.trim() || '0,0,0';
    const [lon, lat] = coords.split(',').map(parseFloat);
    return { name, lat, lon };
  });
}

window.initTravelPanel = initTravelPanel;
