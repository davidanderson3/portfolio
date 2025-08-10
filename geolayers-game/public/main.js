let layers = [];
let current = 0;
let locationId = '';
let finished = false;
let guessedThisLayer = false;
let firstLayer = true;
const guess = document.getElementById('guess');

const layerOrder = ['rivers','lakes','elevation','roads','outline','cities','label'];

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
  layers = layerOrder.map(l => `data/${locationId}/${l}.geojson`);
  loadLayer();
});

const map = L.map('map', { zoomControl:false, attributionControl:false }).setView([37,-95],3);

function styleFor(layer) {
  const name = layer.split('/').pop().replace('.geojson','');
  const colors = {
    rivers: '#0ff',
    lakes: '#00f',
    elevation: '#555',
    roads: '#ff0',
    outline: '#0f0',
    cities: '#f00',
    label: '#fff'
  };
  return { color: colors[name] || '#fff' };
}

function loadLayer() {
  fetch(layers[current]).then(r=>r.json()).then(geo=>{
    const gj = L.geoJSON(geo, {
      style: styleFor(layers[current]),
      pointToLayer: (feature, latlng) => {
        if (layers[current].includes('label')) {
          return L.marker(latlng).bindTooltip(feature.properties.name,{permanent:true});
        }
        return L.circleMarker(latlng, { radius:5, fillOpacity:1, color: styleFor(layers[current]).color });
      }
    }).addTo(map);
    if (firstLayer) {
      map.fitBounds(gj.getBounds());
      firstLayer = false;
    }
    guessedThisLayer = false;
  });
}

document.getElementById('reveal').addEventListener('click', () => {
  if (finished) return;
  if (current < layers.length - 1) {
    current++;
    loadLayer();
  } else {
    document.getElementById('score').textContent = `Answer: ${locationId} (Score: 1)`;
    finished = true;
  }
});

guess.addEventListener('change', () => {
  if (finished || guessedThisLayer) return;
  const val = guess.value;
  if (!val) return;
  if (val === locationId) {
    const points = layers.length - current;
    document.getElementById('score').textContent = `Correct! Score: ${points}`;
    finished = true;
  } else {
    document.getElementById('score').textContent = 'Incorrect!';
    guessedThisLayer = true;
  }
});
