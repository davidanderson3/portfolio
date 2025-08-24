let locationId = '';
let finished = false;
const guess = document.getElementById('guess');
let map;

function pickLocation(locations) {
  return locations[Math.floor(Math.random() * locations.length)];
}

fetch('countries.json').then(r=>r.json()).then(data=>{
  data.sort((a,b)=>a.name.localeCompare(b.name));
  for (const c of data) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.name;
    guess.appendChild(opt);
  }
  const locations = data.map(c=>c.code);
  locationId = pickLocation(locations);
  loadCountry();
});

function loadCountry() {
  fetch(`data/${locationId}/outline.geojson`).then(r=>r.json()).then(outlineGeo=>{
    if (!map) {
      map = L.map('map', { zoomControl:false, attributionControl:false });
    }
    const outline = L.geoJSON(outlineGeo);
    const bounds = outline.getBounds();
    map.fitBounds(bounds);
    map.setView(bounds.getCenter(), map.getZoom() + 1);
    loadRivers();
  });
}

function loadRivers() {
  fetch(`data/${locationId}/rivers.geojson`).then(r=>r.json()).then(geo=>{
    L.geoJSON(geo, { style: { color: '#0ff' } }).addTo(map);
  });
}

guess.addEventListener('change', () => {
  if (finished) return;
  const val = guess.value;
  if (!val) return;
  if (val === locationId) {
    document.getElementById('score').textContent = `Correct! It is ${val}.`;
    finished = true;
  } else {
    document.getElementById('score').textContent = 'Incorrect, try again!';
  }
});
