import { db, getCurrentUser, auth } from './auth.js';
import { getRandomPlaces } from './samplePlaces.js';
import {
  pickDate,
  loadDecisions,
  saveDecisions,
  generateId,
  linkify
} from './helpers.js';
import { appendGoalToDOM } from './goals.js';

const BASE_KEY = 'travelData';

function storageKey() {
  const user = getCurrentUser?.();
  return user ? `${BASE_KEY}-${user.uid}` : BASE_KEY;
}

auth.onAuthStateChanged(user => {
  mapInitialized = false;
  travelData = [];
  if (!user) {
    localStorage.removeItem(BASE_KEY);
  }
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
let markerRowMap = new Map();
let selectedRow = null;
let allTags = [];
let selectedTags = [];
let resultMarkers = [];
let sortByDistance = true;
let userCoords = null;
let showVisited = true;
const pageSize = Infinity;
let currentPage = 0;

// Simple circle markers for map points. Visited places are green.
const createSvgUrl = color =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="${color}"/></svg>`
  )}`;

const defaultIcon = L.icon({
  iconUrl: createSvgUrl('#DB4436'),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const visitedIcon = L.icon({
  iconUrl: createSvgUrl('#62AF44'),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

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

function ensureDefaultTag(place) {
  if (!Array.isArray(place.tags) || place.tags.length === 0) {
    place.tags = ['no tag'];
  }
}

function applyVisitedFlag(place) {
  if (typeof place.visited === 'undefined') {
    place.visited = /icon-503-62AF44/.test(place.styleUrl || '');
  }
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
  const placeCountEl = document.getElementById('placeCount');
  const paginationDiv = document.getElementById('paginationControls');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfoSpan = document.getElementById('pageInfo');
  const showVisitedToggle = document.getElementById('showVisitedToggle');
  map = L.map(mapEl, {
    maxBounds: [
      [-90, -180],
      [90, 180]
    ],
    maxBoundsViscosity: 1.0,
    worldCopyJump: false,
    doubleClickZoom: false
  }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    noWrap: true
  }).addTo(map);

  // Ensure map fills its container once it is visible
  setTimeout(() => map.invalidateSize(), 0);

  map.on('dblclick', async e => {
    const name = prompt('Place name:');
    if (!name) return;
    const description = prompt('Description:');
    const tags = prompt('Tags (comma separated):');
    const rating = prompt('Rating:');
    const date = await pickDate('');
    const visited = confirm('Visited?');
    await storePlace({
      name,
      description: description || '',
      lat: e.latlng.lat,
      lon: e.latlng.lng,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      Rating: rating || '',
      Date: date || '',
      visited
    });
  });

  const user = getCurrentUser?.();
  let cached = null;
  if (user) {
    cached = localStorage.getItem(storageKey());
  }
  travelData = cached ? JSON.parse(cached) : [];
  if (travelData.length === 0) {
    if (user) {
      try {
        const snap = await db
          .collection('users')
          .doc(user.uid)
          .collection('travel')
          .get();
        travelData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('Failed to load travel data', err);
      }
    } else {
      travelData = getRandomPlaces();
    }
  }
  travelData.forEach(p => {
    ensureDefaultTag(p);
    applyVisitedFlag(p);
  });
  if (user) {
    localStorage.setItem(storageKey(), JSON.stringify(travelData));
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
        currentPage = 0;
        renderTagFilters();
        renderList(currentSearch);
      });
      tagFiltersDiv.append(btn);
    });
  };

  renderTagFilters();

  function updatePagination(total) {
    if (!paginationDiv) return;
    const totalPages = Math.ceil(total / pageSize) || 1;
    pageInfoSpan.textContent = `${currentPage + 1} / ${totalPages}`;
    prevPageBtn.disabled = currentPage === 0;
    nextPageBtn.disabled = currentPage >= totalPages - 1;
  }

  prevPageBtn?.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage -= 1;
      renderList(currentSearch);
    }
  });

  nextPageBtn?.addEventListener('click', () => {
    currentPage += 1;
    renderList(currentSearch);
  });

  if (showVisitedToggle) {
    showVisitedToggle.checked = showVisited;
    showVisitedToggle.addEventListener('change', () => {
      showVisited = showVisitedToggle.checked;
      currentPage = 0;
      renderList(currentSearch);
    });
  }

  const renderList = (term = '', customItems = null) => {
    tableBody.innerHTML = '';
    if (customItems) currentPage = 0;
    markers.forEach(m => m.remove());
    markers = [];
    rowMarkerMap.clear();
    markerRowMap.clear();
    let items;
    if (Array.isArray(customItems)) {
      items = customItems;
    } else {
      items = travelData.filter(
        p =>
          p.name.toLowerCase().includes(term.toLowerCase()) &&
          (selectedTags.length === 0 ||
            (Array.isArray(p.tags) && selectedTags.some(t => p.tags.includes(t)))) &&
          (showVisited || !p.visited)
      );
    }

    if (sortByDistance && userCoords) {
      items.sort(
        (a, b) =>
          haversine(userCoords[0], userCoords[1], a.lat, a.lon) -
          haversine(userCoords[0], userCoords[1], b.lat, b.lon)
      );
    }
    const total = items.length;
    let start;
    let pageItems;
    if (pageSize === Infinity) {
      start = 0;
      pageItems = items;
      if (paginationDiv) paginationDiv.style.display = 'none';
    } else {
      start = currentPage * pageSize;
      pageItems = items.slice(start, start + pageSize);
      if (paginationDiv) paginationDiv.style.display = '';
      updatePagination(total);
    }
    if (placeCountEl) {
      const end =
        pageSize === Infinity ? total : Math.min(start + pageItems.length, total);
      placeCountEl.textContent =
        total === 0 ? 'Showing 0 of 0' : `Showing ${start + 1}-${end} of ${total}`;
    }

    pageItems.forEach((p, index) => {
      const icon =
        p.visited || /icon-503-62AF44/.test(p.styleUrl)
          ? visitedIcon
          : defaultIcon;
      const m = L.marker([p.lat, p.lon], { icon }).addTo(map).bindPopup(p.name);
      markers.push(m);
      m.on('click', () => {
        const row = markerRowMap.get(m);
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
      const nameLink = document.createElement('a');
      nameLink.href = `https://www.google.com/search?q=${encodeURIComponent(p.name)}`;
      nameLink.textContent = p.name;
      nameLink.target = '_blank';
      nameTd.appendChild(nameLink);
      nameTd.dataset.label = 'Name';
      const descTd = document.createElement('td');
      descTd.innerHTML = linkify(p.description || '');
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
      if (p.visited) visitedTd.classList.add('visited-icon');
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
        td.className = 'edit-cell';

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
        dateInput.type = 'date';
        dateInput.value = p.Date || '';
        const visitedInput = document.createElement('input');
        visitedInput.type = 'checkbox';
        visitedInput.checked = !!p.visited;
        visitedInput.title = 'Visited';
        const visitedLabel = document.createElement('label');
        visitedLabel.style.whiteSpace = 'nowrap';
        visitedLabel.append(visitedInput, ' Visited');

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        [saveBtn, cancelBtn].forEach(b =>
          Object.assign(b.style, {
            background: 'none',
            border: '1px solid #999',
            padding: '2px 6px',
            marginTop: '0'
          })
        );

        visitedLabel.style.display = 'flex';
        visitedLabel.style.alignItems = 'center';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '4px';
        btnRow.append(saveBtn, cancelBtn);

        form.append(
          nameInput,
          descInput,
          tagsInput,
          tagList,
          ratingInput,
          dateInput,
          visitedLabel,
          btnRow
        );
        td.append(form);
        tr.append(td);

        form.addEventListener('submit', async ev => {
          ev.preventDefault();
          p.name = nameInput.value.trim();
          p.description = descInput.value.trim();
          p.tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
          ensureDefaultTag(p);
          p.Rating = ratingInput.value.trim();
          p.Date = dateInput.value.trim();
          p.visited = visitedInput.checked;
          const user = getCurrentUser?.();
          if (user) {
            localStorage.setItem(storageKey(), JSON.stringify(travelData));
            try {
              if (p.id)
                await db.collection('users').doc(user.uid).collection('travel').doc(p.id).set(p);
            } catch (err) {
              console.error('Failed to update place', err);
            }
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

      const goalBtn = document.createElement('button');
      goalBtn.textContent = '🎯';
      goalBtn.title = 'Add as goal';
      Object.assign(goalBtn.style, { background: 'none', border: 'none', cursor: 'pointer' });
      goalBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await addPlaceAsGoal(p);
      });
      actionsTd.append(goalBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '❌';
      delBtn.title = 'Delete';
      Object.assign(delBtn.style, { background: 'none', border: 'none', cursor: 'pointer' });
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete this place?')) return;
        const user = getCurrentUser?.();
        if (user && p.id) {
          try {
            await db.collection('users').doc(user.uid).collection('travel').doc(p.id).delete();
          } catch (err) {
            console.error('Failed to delete place', err);
          }
        }
        travelData.splice(travelData.indexOf(p), 1);
        if (user) {
          localStorage.setItem(storageKey(), JSON.stringify(travelData));
        }
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
      markerRowMap.set(m, tr);

      tr.addEventListener('click', e => {
        // If the user clicked a link inside the row, allow the link to
        // navigate without selecting the row or moving the map.
        if (e.target.closest('a')) return;

        if (selectedRow) selectedRow.classList.remove('selected-row');
        selectedRow = tr;
        tr.classList.add('selected-row');
        map.setView([p.lat, p.lon], 8);
        m.openPopup();
        // mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Don't auto-scroll to the map when selecting a place
      });
    });
  };

  const renderDefaultList = () => {
    currentPage = 0;
    renderList('');
  };


  const clearSearchResults = () => {
    if (resultsList) resultsList.innerHTML = '';
    resultMarkers.forEach(m => m.remove());
    resultMarkers = [];
  };
  async function storePlace(place) {
    ensureDefaultTag(place);
    applyVisitedFlag(place);
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
    const currentUser = getCurrentUser?.();
    if (currentUser) {
      localStorage.setItem(storageKey(), JSON.stringify(travelData));
    }
    allTags = Array.from(new Set(travelData.flatMap(p => p.tags || []))).sort();
    renderTagFilters();
    renderList(currentSearch);
  }

  async function addPlaceAsGoal(place) {
    const all = await loadDecisions();
    const newGoal = {
      id: generateId(),
      type: 'goal',
      text: `Visit ${place.name}`,
      notes: place.description || '',
      completed: false,
      resolution: '',
      dateCompleted: '',
      parentGoalId: null,
      hiddenUntil: null,
      deadline: '',
      scheduled: place.Date || '',
      scheduledEnd: ''
    };
    await saveDecisions([...all, newGoal]);
    appendGoalToDOM(newGoal, [...all, newGoal]);
  }


  if (searchInput) {
    searchInput.addEventListener('input', e => {
      currentSearch = e.target.value;
      currentPage = 0;
      renderList(currentSearch);
    });
  }

  if (user) {
    db
      .collection('users')
      .doc(user.uid)
      .collection('travel')
      .onSnapshot(
        snap => {
          travelData = snap.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() };
            ensureDefaultTag(data);
            applyVisitedFlag(data);
            return data;
          });
          localStorage.setItem(storageKey(), JSON.stringify(travelData));
          allTags = Array.from(new Set(travelData.flatMap(p => p.tags || []))).sort();
          renderTagFilters();
          renderList(currentSearch);
        },
        err => {
          console.error('Failed to sync travel data', err);
        }
      );
  }


  const renderInitial = () => {
    renderDefaultList();
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userCoords = [pos.coords.latitude, pos.coords.longitude];
        renderInitial();
      },
      () => {
        // location retrieval failed; still render list without userCoords
        renderInitial();
      }
    );
  } else {
    renderInitial();
  }

  const dmsToDecimal = (deg, min, sec, dir) => {
    const dec = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
    return /[SW]/i.test(dir) ? -dec : dec;
  };
  const ddmToDecimal = (deg, min, dir) => {
    const dec = Number(deg) + Number(min) / 60;
    return /[SW]/i.test(dir) ? -dec : dec;
  };
  const parseCoordinates = input => {
    const ddMatch = input.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (ddMatch) {
      return { lat: parseFloat(ddMatch[1]), lon: parseFloat(ddMatch[2]) };
    }
    const dmsMatch = input.match(/^[\s]*?(\d{1,3})[°\s]\s*(\d{1,2})['\s]\s*(\d{1,2}(?:\.\d+)?)["\s]?\s*([NS])[,\s]+(\d{1,3})[°\s]\s*(\d{1,2})['\s]\s*(\d{1,2}(?:\.\d+)?)["\s]?\s*([EW])\s*$/i);
    if (dmsMatch) {
      const lat = dmsToDecimal(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
      const lon = dmsToDecimal(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);
      return { lat, lon };
    }
    const ddmMatch = input.match(/^\s*(\d{1,3})[°\s]\s*(\d{1,2}(?:\.\d+)?)[']?\s*([NS])[,\s]+(\d{1,3})[°\s]\s*(\d{1,2}(?:\.\d+)?)[']?\s*([EW])\s*$/i);
    if (ddmMatch) {
      const lat = ddmToDecimal(ddmMatch[1], ddmMatch[2], ddmMatch[3]);
      const lon = ddmToDecimal(ddmMatch[4], ddmMatch[5], ddmMatch[6]);
      return { lat, lon };
    }
    return null;
  };

  if (placeInput) {
    placeInput.addEventListener('keydown', async e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const term = placeInput.value.trim();
      if (!term) return;
      clearSearchResults();
      const coords = parseCoordinates(term);
      if (coords) {
        const { lat, lon } = coords;
        const m = L.marker([lat, lon], { icon: defaultIcon }).addTo(map);
        resultMarkers.push(m);
        const popupDiv = document.createElement('div');
        const title = document.createElement('div');
        title.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        const btn = document.createElement('button');
        btn.textContent = 'Add to list';
        popupDiv.append(title, btn);
        m.bindPopup(popupDiv);
        btn.addEventListener('click', async () => {
          const name = prompt('Place name:', '');
          if (!name) return;
          await storePlace({ name, description: '', lat, lon, tags: [], Rating: '', Date: '', visited: false });
          clearSearchResults();
          placeInput.value = '';
        });
        const li = document.createElement('li');
        li.textContent = title.textContent;
        li.addEventListener('click', () => {
          map.setView([lat, lon], 8);
          m.openPopup();
        });
        if (resultsList) resultsList.append(li);
        map.setView([lat, lon], 8);
        return;
      }
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(term)}`);
        const data = await resp.json();
        if (data && data.length) {
          const latLngs = [];
          data.forEach((res, idx) => {
            const { lat, lon, display_name } = res;
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            latLngs.push([latitude, longitude]);
            const m = L.marker([latitude, longitude], { icon: defaultIcon }).addTo(map);
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
            });
            if (resultsList) resultsList.append(li);
          });
          if (latLngs.length === 1) {
            map.setView(latLngs[0], 8);
          } else {
            map.fitBounds(latLngs);
          }
        } else {
          alert('Place not found');
        }
      } catch (err) {
        console.error('Error searching place', err);
      }
    });
  }

  const addBtn = document.getElementById('addPlaceBtn');
  addBtn?.addEventListener('click', async () => {
    const name = prompt('Place name:');
    const description = prompt('Description:');
    const tags = prompt('Tags (comma separated):');
    const rating = prompt('Rating:');
    const date = await pickDate('');
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
