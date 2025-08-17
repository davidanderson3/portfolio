let locationId = '';
let finished = false;
const guess = document.getElementById('guess');

function dailySeed() {
  const today = new Date().toISOString().slice(0,10);
  let seed = 0;
  for (const c of today) {
    seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  }
  return seed;
}

function pickLocation(locations) {
  const seed = dailySeed();
  return locations[seed % locations.length];
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
  loadRivers();
});

const map = L.map('map', { zoomControl:false, attributionControl:false }).setView([0,0],2);

function loadRivers() {
  fetch(`data/${locationId}/rivers.geojson`).then(r=>r.json()).then(geo=>{
    const gj = L.geoJSON(geo, { style: { color: '#0ff' } }).addTo(map);
    map.fitBounds(gj.getBounds());
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
