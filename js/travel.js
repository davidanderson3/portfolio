import { db } from './auth.js';

let mapInitialized = false;
let map;
let markers = [];
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
    travelData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (!travelData.length) {
      throw new Error('No travel docs');
    }
    localStorage.setItem('travelData', JSON.stringify(travelData));
  } catch (err) {
    console.error('Failed to load travel data', err);
    const cached = localStorage.getItem('travelData');
    travelData = cached ? JSON.parse(cached) : [];
  }

  const renderList = () => {
    list.innerHTML = '';
    markers.forEach(m => m.remove());
    markers = [];
    travelData.forEach((p, idx) => {
      const m = L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
      markers.push(m);
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = `${p.name} (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})`;
      li.append(span);

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.title = 'Edit';
      editBtn.addEventListener('click', async () => {
        const name = prompt('Place name:', p.name);
        const lat = parseFloat(prompt('Latitude:', p.lat));
        const lon = parseFloat(prompt('Longitude:', p.lon));
        if (!name || Number.isNaN(lat) || Number.isNaN(lon)) return;
        Object.assign(p, { name, lat, lon });
        localStorage.setItem('travelData', JSON.stringify(travelData));
        try {
          if (p.id) await db.collection('travel').doc(p.id).set({ name, lat, lon });
        } catch (err) {
          console.error('Failed to update place', err);
        }
        renderList();
      });
      li.append(editBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '❌';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this place?')) return;
        if (p.id) {
          try {
            await db.collection('travel').doc(p.id).delete();
          } catch (err) {
            console.error('Failed to delete place', err);
          }
        }
        travelData.splice(idx, 1);
        localStorage.setItem('travelData', JSON.stringify(travelData));
        renderList();
      });
      li.append(delBtn);

      list.append(li);
    });
  };

  renderList();

  document.getElementById('addPlaceBtn').addEventListener('click', async () => {
    const name = prompt('Place name:');
    const lat = parseFloat(prompt('Latitude:'));
    const lon = parseFloat(prompt('Longitude:'));
    if (!name || Number.isNaN(lat) || Number.isNaN(lon)) return;
    const place = { name, lat, lon };
    try {
      const docRef = await db.collection('travel').add(place);
      place.id = docRef.id;
    } catch (err) {
      console.error('Failed to save place to Firestore', err);
    }
    travelData.push(place);
    localStorage.setItem('travelData', JSON.stringify(travelData));
    renderList();
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
