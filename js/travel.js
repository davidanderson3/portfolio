import { db, getCurrentUser, auth } from './auth.js';

const BASE_KEY = 'travelData';

function storageKey() {
  const user = getCurrentUser?.();
  return user ? `${BASE_KEY}-${user.uid}` : BASE_KEY;
}

auth.onAuthStateChanged(() => {
  mapInitialized = false;
  travelData = [];
});

let mapInitialized = false;
let map;
let markers = [];
let travelData = [];
let currentSearch = '';
let rowMarkerMap = new Map();
let selectedRow = null;
let allTags = [];
let selectedTags = [];

export async function initTravelPanel() {
  const panel = document.getElementById('travelPanel');
  if (!panel || mapInitialized) return;
  mapInitialized = true;

  const mapEl = document.getElementById('travelMap');
  const tableBody = document.querySelector('#travelTable tbody');
  const searchInput = document.getElementById('travelSearch');
  const placeInput = document.getElementById('placeSearch');
  const tagFiltersDiv = document.getElementById('travelTagFilters');
  map = L.map(mapEl).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const user = getCurrentUser?.();
  try {
    if (user) {
      const snap = await db
        .collection('users')
        .doc(user.uid)
        .collection('travel')
        .get();
      travelData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      travelData = [];
    }
    localStorage.setItem(storageKey(), JSON.stringify(travelData));
  } catch (err) {
    console.error('Failed to load travel data', err);
    const cached = localStorage.getItem(storageKey());
    travelData = cached ? JSON.parse(cached) : [];
  }

  allTags = Array.from(new Set(travelData.flatMap(p => p.tags || []))).sort();

  const renderTagFilters = () => {
    if (!tagFiltersDiv) return;
    tagFiltersDiv.innerHTML = '';
    allTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = tag;
      btn.className = 'tag-filter-button';
      if (selectedTags.includes(tag)) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (selectedTags.includes(tag)) {
          selectedTags = selectedTags.filter(t => t !== tag);
        } else {
          selectedTags.push(tag);
        }
        renderTagFilters();
        renderList(currentSearch);
      });
      tagFiltersDiv.append(btn);
    });
  };

  renderTagFilters();

  const renderList = (term = '') => {
    tableBody.innerHTML = '';
    markers.forEach(m => m.remove());
    markers = [];
    rowMarkerMap.clear();
    const items = travelData.filter(p =>
      p.name.toLowerCase().includes(term.toLowerCase()) &&
      (selectedTags.length === 0 ||
        (Array.isArray(p.tags) && selectedTags.every(t => p.tags.includes(t))))
    );

    items.forEach((p, index) => {
      const m = L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
      markers.push(m);
      if (term && items.length === 1 && index === 0) {
        map.setView([p.lat, p.lon], 8);
        m.openPopup();
      }
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.textContent = p.name;
      const descTd = document.createElement('td');
      descTd.textContent = p.description || '';
      const tagsTd = document.createElement('td');
      tagsTd.textContent = Array.isArray(p.tags) ? p.tags.join(', ') : '';
      const ratingTd = document.createElement('td');
      ratingTd.textContent = p.Rating || '';
      const dateTd = document.createElement('td');
      dateTd.textContent = p.Date || '';
      const visitedTd = document.createElement('td');
      visitedTd.textContent = p.visited ? '✅' : '';
      const actionsTd = document.createElement('td');
      actionsTd.style.whiteSpace = 'nowrap';

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.title = 'Edit';
      Object.assign(editBtn.style, { background: 'none', border: 'none', cursor: 'pointer' });
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        tr.innerHTML = '';
        const form = document.createElement('form');
        form.style.display = 'flex';
        form.style.flexWrap = 'wrap';
        form.style.gap = '4px';
        const td = document.createElement('td');
        td.colSpan = 7;

        const nameInput = document.createElement('input');
        nameInput.value = p.name || '';
        nameInput.placeholder = 'name';
        const descInput = document.createElement('input');
        descInput.value = p.description || '';
        descInput.placeholder = 'description';
        const tagsInput = document.createElement('input');
        tagsInput.value = Array.isArray(p.tags) ? p.tags.join(', ') : '';
        tagsInput.placeholder = 'tags';
        const ratingInput = document.createElement('input');
        ratingInput.value = p.Rating || '';
        ratingInput.placeholder = 'rating';
        const dateInput = document.createElement('input');
        dateInput.value = p.Date || '';
        dateInput.placeholder = 'date';
        const visitedInput = document.createElement('input');
        visitedInput.type = 'checkbox';
        visitedInput.checked = !!p.visited;
        visitedInput.title = 'Visited';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        [saveBtn, cancelBtn].forEach(b => Object.assign(b.style, { background: 'none', border: '1px solid #999', padding: '2px 6px' }));

        form.append(
          nameInput,
          descInput,
          tagsInput,
          ratingInput,
          dateInput,
          visitedInput,
          saveBtn,
          cancelBtn
        );
        td.append(form);
        tr.append(td);

        form.addEventListener('submit', async ev => {
          ev.preventDefault();
          p.name = nameInput.value.trim();
          p.description = descInput.value.trim();
          p.tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
          p.Rating = ratingInput.value.trim();
          p.Date = dateInput.value.trim();
          p.visited = visitedInput.checked;
          localStorage.setItem(storageKey(), JSON.stringify(travelData));
          try {
            const user = getCurrentUser?.();
            if (user && p.id)
              await db.collection('users').doc(user.uid).collection('travel').doc(p.id).set(p);
          } catch (err) {
            console.error('Failed to update place', err);
          }
          allTags = Array.from(new Set(travelData.flatMap(pl => pl.tags || []))).sort();
          renderTagFilters();
          renderList(currentSearch);
        });
        cancelBtn.addEventListener('click', e2 => {
          e2.preventDefault();
          renderList(currentSearch);
        });
      });
      actionsTd.append(editBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '❌';
      delBtn.title = 'Delete';
      Object.assign(delBtn.style, { background: 'none', border: 'none', cursor: 'pointer' });
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete this place?')) return;
        if (p.id) {
          try {
            const user = getCurrentUser?.();
            if (user)
              await db.collection('users').doc(user.uid).collection('travel').doc(p.id).delete();
          } catch (err) {
            console.error('Failed to delete place', err);
          }
        }
        travelData.splice(travelData.indexOf(p), 1);
        localStorage.setItem(storageKey(), JSON.stringify(travelData));
        allTags = Array.from(new Set(travelData.flatMap(pl => pl.tags || []))).sort();
        renderTagFilters();
        renderList(currentSearch);
      });
      actionsTd.append(delBtn);

      tr.append(nameTd, descTd, tagsTd, ratingTd, dateTd, visitedTd, actionsTd);
      tableBody.append(tr);
      rowMarkerMap.set(tr, m);

      tr.addEventListener('click', () => {
        if (selectedRow) selectedRow.classList.remove('selected-row');
        selectedRow = tr;
        tr.classList.add('selected-row');
        map.setView([p.lat, p.lon], 8);
        m.openPopup();
      });
    });
  };

  renderList(currentSearch);

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      currentSearch = e.target.value;
      renderList(currentSearch);
    });
  }

  if (placeInput) {
    placeInput.addEventListener('keydown', async e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const term = placeInput.value.trim();
      if (!term) return;
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(term)}`);
        const data = await resp.json();
        if (data && data.length) {
          const { lat, lon } = data[0];
          map.setView([parseFloat(lat), parseFloat(lon)], 8);
        } else {
          alert('Place not found');
        }
      } catch (err) {
        console.error('Error searching place', err);
      }
    });
  }

  document.getElementById('addPlaceBtn').addEventListener('click', async () => {
    const name = prompt('Place name:');
    const description = prompt('Description:');
    const tags = prompt('Tags (comma separated):');
    const rating = prompt('Rating:');
    const date = prompt('Date:');
    const visited = confirm('Visited?');
    const lat = parseFloat(prompt('Latitude:'));
    const lon = parseFloat(prompt('Longitude:'));
    if (!name || Number.isNaN(lat) || Number.isNaN(lon)) return;
    const place = {
      name,
      description: description || '',
      lat,
      lon,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      Rating: rating || '',
      Date: date || '',
      visited
    };
    try {
      const user = getCurrentUser?.();
      if (user) {
        const docRef = await db
          .collection('users')
          .doc(user.uid)
          .collection('travel')
          .add(place);
        place.id = docRef.id;
      }
    } catch (err) {
      console.error('Failed to save place to Firestore', err);
    }
    travelData.push(place);
    localStorage.setItem(storageKey(), JSON.stringify(travelData));
    allTags = Array.from(new Set(travelData.flatMap(p => p.tags || []))).sort();
    renderTagFilters();
    renderList(currentSearch);
  });
}

// legacy parser kept for potential future imports
export function parseKml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const placemarks = Array.from(doc.querySelectorAll('Placemark'));
  return placemarks.map(pm => {
    const name = pm.querySelector('name')?.textContent || 'Unknown';
    const description =
      pm.querySelector('ExtendedData Data[name="description"] value')?.textContent ||
      pm.querySelector('description')?.textContent ||
      '';
    const coords = pm.querySelector('coordinates')?.textContent.trim() || '0,0,0';
    const [lon, lat] = coords.split(',').map(parseFloat);
    return { name, description, lat, lon };
  });
}

window.initTravelPanel = initTravelPanel;
