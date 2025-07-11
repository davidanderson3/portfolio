import { db, getCurrentUser, auth } from './auth.js';

const BASE_KEY = 'travelData';

function storageKey() {
  const user = getCurrentUser?.();
  return user ? `${BASE_KEY}-${user.uid}` : BASE_KEY;
}

auth.onAuthStateChanged(() => {
  mapInitialized = false;
  travelData = [];
  // Reload travel data for the newly authenticated user.
  // initTravelPanel safely exits if DOM is not ready or already initialized.
  initTravelPanel().catch(err =>
    console.error('Failed to reload travel data after auth change', err)
  );
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
let searchMarker = null;
let resultMarkers = [];
let sortByDistance = true;
let userCoords = null;
let showVisited = false;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // miles
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function initTravelPanel() {
  const panel = document.getElementById('travelPanel');
  if (!panel) return;
  if (mapInitialized) {
    // panel is being re-shown; resize the map to fill its container
    map.invalidateSize();
    return;
  }
  mapInitialized = true;

  const mapEl = document.getElementById('travelMap');
  const tableBody = document.querySelector('#travelTable tbody');
  const searchInput = document.getElementById('travelSearch');
  const placeInput = document.getElementById('placeSearch');
  const resultsList = document.getElementById('placeResults');
  const tagFiltersDiv = document.getElementById('travelTagFilters');
  const showVisitedToggle = document.getElementById('showVisitedToggle');
  map = L.map(mapEl, {
    maxBounds: [
      [-90, -180],
      [90, 180]
    ],
    maxBoundsViscosity: 1.0,
    worldCopyJump: false
  }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    noWrap: true
  }).addTo(map);

  // Ensure map fills its container once it is visible
  setTimeout(() => map.invalidateSize(), 0);

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

  if (showVisitedToggle) {
    showVisitedToggle.checked = showVisited;
    showVisitedToggle.addEventListener('change', () => {
      showVisited = showVisitedToggle.checked;
      renderList(currentSearch);
    });
  }

  const renderList = (term = '') => {
    tableBody.innerHTML = '';
    markers.forEach(m => m.remove());
    markers = [];
    rowMarkerMap.clear();
    const items = travelData.filter(
      p =>
        p.name.toLowerCase().includes(term.toLowerCase()) &&
        (selectedTags.length === 0 ||
          (Array.isArray(p.tags) && selectedTags.some(t => p.tags.includes(t)))) &&
        (showVisited || !p.visited)
    );

    if (sortByDistance && userCoords) {
      items.sort(
        (a, b) =>
          haversine(userCoords[0], userCoords[1], a.lat, a.lon) -
          haversine(userCoords[0], userCoords[1], b.lat, b.lon)
      );
    }

    items.forEach((p, index) => {
      const m = L.marker([p.lat, p.lon]).addTo(map).bindPopup(p.name);
      markers.push(m);
      m.on('click', () => {
        if (searchInput) searchInput.value = p.name;
        currentSearch = p.name;
        renderList(currentSearch);
        const row = tableBody.querySelector('tr');
        if (row) {
          if (selectedRow) selectedRow.classList.remove('selected-row');
          selectedRow = row;
          row.classList.add('selected-row');
        }
      });
      if (term && items.length === 1 && index === 0) {
        map.setView([p.lat, p.lon], 8);
        m.openPopup();
      }
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.textContent = p.name;
      nameTd.dataset.label = 'Name';
      const descTd = document.createElement('td');
      descTd.textContent = p.description || '';
      descTd.dataset.label = 'Description';
      const tagsTd = document.createElement('td');
      tagsTd.textContent = Array.isArray(p.tags) ? p.tags.join(', ') : '';
      tagsTd.dataset.label = 'Tags';
      const ratingTd = document.createElement('td');
      ratingTd.textContent = p.Rating || '';
      ratingTd.dataset.label = 'Rating';
      const dateTd = document.createElement('td');
      dateTd.textContent = p.Date || '';
      dateTd.dataset.label = 'Date';
      const visitedTd = document.createElement('td');
      visitedTd.textContent = p.visited ? '✅' : '';
      visitedTd.dataset.label = 'Visited';
      const distTd = document.createElement('td');
      distTd.dataset.label = 'Distance (mi)';
      if (userCoords) {
        const dist = haversine(userCoords[0], userCoords[1], p.lat, p.lon);
        distTd.textContent = dist.toFixed(1);
      } else {
        distTd.textContent = '';
      }
      const actionsTd = document.createElement('td');
      actionsTd.dataset.label = 'Actions';
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
        td.colSpan = 8;

        const nameInput = document.createElement('input');
        nameInput.value = p.name || '';
        nameInput.placeholder = 'name';
        const descInput = document.createElement('input');
        descInput.value = p.description || '';
        descInput.placeholder = 'description';
        const tagsInput = document.createElement('input');
        tagsInput.value = Array.isArray(p.tags) ? p.tags.join(', ') : '';
        tagsInput.placeholder = 'tags';
        const tagList = document.createElement('datalist');
        const listId = `tag-list-${Date.now()}-${Math.random()}`;
        tagList.id = listId;
        tagsInput.setAttribute('list', listId);
        const updateTagSuggestions = () => {
          const val = tagsInput.value;
          const parts = val.split(',');
          const partial = parts.pop().trim().toLowerCase();
          const prefix = parts.map(t => t.trim()).filter(Boolean).join(', ');
          const used = parts.map(t => t.trim()).filter(Boolean);
          tagList.innerHTML = '';
          allTags
            .filter(t =>
              t.toLowerCase().startsWith(partial) && !used.includes(t)
            )
            .forEach(t => {
              const option = document.createElement('option');
              option.value = prefix ? `${prefix}, ${t}` : t;
              tagList.appendChild(option);
            });
        };
        tagsInput.addEventListener('input', updateTagSuggestions);
        updateTagSuggestions();
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
          tagList,
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

      tr.append(
        nameTd,
        descTd,
        tagsTd,
        ratingTd,
        dateTd,
        visitedTd,
        distTd,
        actionsTd
      );
      tableBody.append(tr);
      rowMarkerMap.set(tr, m);

      tr.addEventListener('click', () => {
        if (selectedRow) selectedRow.classList.remove('selected-row');
        selectedRow = tr;
        tr.classList.add('selected-row');
        map.setView([p.lat, p.lon], 8);
        m.openPopup();
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };


  const clearSearchResults = () => {
    if (resultsList) resultsList.innerHTML = '';
    resultMarkers.forEach(m => m.remove());
    resultMarkers = [];
    if (searchMarker) {
      searchMarker.remove();
      searchMarker = null;
    }
  };
  async function storePlace(place) {
    try {
      const user = getCurrentUser?.();
      if (user) {
        const docRef = await db.collection("users").doc(user.uid).collection("travel").add(place);
        place.id = docRef.id;
      }
    } catch (err) {
      console.error("Failed to save place to Firestore", err);
    }
    travelData.push(place);
    localStorage.setItem(storageKey(), JSON.stringify(travelData));
    allTags = Array.from(new Set(travelData.flatMap(p => p.tags || []))).sort();
    renderTagFilters();
    renderList(currentSearch);
  }


  if (searchInput) {
    searchInput.addEventListener('input', e => {
      currentSearch = e.target.value;
      renderList(currentSearch);
    });
  }


  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userCoords = [pos.coords.latitude, pos.coords.longitude];
        renderList(currentSearch);
      },
      () => {
        // location retrieval failed; still render list without userCoords
        renderList(currentSearch);
      }
    );
  } else {
    renderList(currentSearch);
  }

  if (placeInput) {
    placeInput.addEventListener('keydown', async e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const term = placeInput.value.trim();
      if (!term) return;
      clearSearchResults();
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(term)}`);
        const data = await resp.json();
        if (data && data.length) {
          data.forEach((res, idx) => {
            const { lat, lon, display_name } = res;
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            const m = L.marker([latitude, longitude]).addTo(map);
            resultMarkers.push(m);
            const popupDiv = document.createElement('div');
            const title = document.createElement('div');
            title.textContent = display_name;
            const btn = document.createElement('button');
            btn.textContent = 'Add to list';
            popupDiv.append(title, btn);
            m.bindPopup(popupDiv);
            btn.addEventListener('click', async () => {
              const name = prompt('Place name:', display_name.split(',')[0]);
              if (!name) return;
              await storePlace({ name, description: '', lat: latitude, lon: longitude, tags: [], Rating: '', Date: '', visited: false });
              clearSearchResults();
              placeInput.value = '';
            });

            const li = document.createElement('li');
            li.textContent = display_name;
            li.addEventListener('click', () => {
              map.setView([latitude, longitude], 8);
              m.openPopup();
              clearSearchResults();
            });
            if (resultsList) resultsList.append(li);
          });
          const first = data[0];
          map.setView([parseFloat(first.lat), parseFloat(first.lon)], 4);
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
    await storePlace(place);
  });

}

window.initTravelPanel = initTravelPanel;
