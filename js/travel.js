import { db } from './auth.js';

let mapInitialized = false;
let map;
let markers = [];
let travelData = [];
let currentSearch = '';

export async function initTravelPanel() {
  const panel = document.getElementById('travelPanel');
  if (!panel || mapInitialized) return;
  mapInitialized = true;

  const mapEl = document.getElementById('travelMap');
  const list = document.getElementById('travelList');
  const searchInput = document.getElementById('travelSearch');
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

  const renderList = (term = '') => {
    list.innerHTML = '';
    markers.forEach(m => m.remove());
    markers = [];
    const items = travelData.filter(p => {
      if (!term) return true;
      const str = Object.values(p).join(' ').toLowerCase();
      return str.includes(term.toLowerCase());
    });
    const formatPlace = pl =>
      Object.entries(pl)
        .filter(([k]) => k !== 'id')
        .map(([k, v]) => {
          if (k === 'lat' || k === 'lon') return `${k}: ${Number(v).toFixed(4)}`;
          return `${k}: ${v}`;
        })
        .join(', ');

    items.forEach((p, index) => {
      const m = L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
      markers.push(m);
      if (term && items.length === 1 && index === 0) {
        map.setView([p.lat, p.lon], 8);
        m.openPopup();
      }
      const li = document.createElement('li');
      const infoSpan = document.createElement('span');
      infoSpan.textContent = formatPlace(p);
      li.append(infoSpan);

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.title = 'Edit';
      Object.assign(editBtn.style, { background: 'none', border: 'none', cursor: 'pointer' });
      editBtn.addEventListener('click', () => {
        li.innerHTML = '';
        const form = document.createElement('form');
        const inputs = {};
        Object.entries(p).forEach(([k, v]) => {
          if (['id', 'lat', 'lon'].includes(k)) return;
          const input = document.createElement('input');
          input.value = v ?? '';
          input.placeholder = k;
          input.style.marginRight = '4px';
          form.append(input);
          inputs[k] = input;
        });
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        [saveBtn, cancelBtn].forEach(b => Object.assign(b.style, { background: 'none', border: '1px solid #999', padding: '2px 6px', marginLeft: '4px' }));
        form.append(saveBtn, cancelBtn);
        li.append(form);

        form.addEventListener('submit', async e => {
          e.preventDefault();
          Object.keys(inputs).forEach(key => {
            p[key] = inputs[key].value;
          });
          localStorage.setItem('travelData', JSON.stringify(travelData));
          try {
            if (p.id) await db.collection('travel').doc(p.id).set(p);
          } catch (err) {
            console.error('Failed to update place', err);
          }
          renderList(currentSearch);
        });
        cancelBtn.addEventListener('click', e => {
          e.preventDefault();
          renderList(currentSearch);
        });
      });
      li.append(editBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '❌';
      delBtn.title = 'Delete';
      Object.assign(delBtn.style, { background: 'none', border: 'none', cursor: 'pointer' });
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this place?')) return;
        if (p.id) {
          try {
            await db.collection('travel').doc(p.id).delete();
          } catch (err) {
            console.error('Failed to delete place', err);
          }
        }
        travelData.splice(travelData.indexOf(p), 1);
        localStorage.setItem('travelData', JSON.stringify(travelData));
        renderList(currentSearch);
      });
      li.append(delBtn);

      list.append(li);
    });
  };

  renderList(currentSearch);

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      currentSearch = e.target.value;
      renderList(currentSearch);
    });
  }

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
    renderList(currentSearch);
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
