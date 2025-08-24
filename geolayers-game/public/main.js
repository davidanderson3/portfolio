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
  Promise.all([
    fetch(`data/${locationId}/outline.geojson`).then(r => r.json()),
    fetch(`data/${locationId}/rivers.geojson`).then(r => r.json())
  ]).then(([outlineGeo, riversGeo]) => {
    if (!map) {
      map = L.map('map', { zoomControl: false, attributionControl: false });
    } else {
      map.eachLayer(l => map.removeLayer(l));
    }

    const outline = L.geoJSON(outlineGeo);
    const riversLayer = L.geoJSON(riversGeo, { style: { color: '#0ff' } });

    let minLat = 90, minLng = 180, maxLat = -90, maxLng = -180;
    const features = [...outlineGeo.features, ...riversGeo.features];

    function processCoords(coords) {
      if (typeof coords[0] === 'number') {
        const [lng, lat] = coords;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      } else {
        coords.forEach(processCoords);
      }
    }

    features.forEach(f => processCoords(f.geometry.coordinates));
    const bounds = L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
    map.fitBounds(bounds.pad(-0.2));

    outline.addTo(map);
    riversLayer.addTo(map);
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
