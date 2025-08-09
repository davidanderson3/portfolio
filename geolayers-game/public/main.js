let layers = [];
let current = 0;
let locationId = '';
let finished = false;
let guessedThisLayer = false;
let firstLayer = true;
const guess = document.getElementById('guess');

fetch('/countries').then(r=>r.json()).then(data=>{
  data.sort((a,b)=>a.name.localeCompare(b.name));
  for (const c of data) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.name;
    guess.appendChild(opt);
  }
});

const map = L.map('map', { zoomControl:false, attributionControl:false }).setView([37,-95],3);

function styleFor(layer) {
  const name = layer.split('/').pop();
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

fetch('/daily').then(r=>r.json()).then(data=>{
  locationId = data.locationId;
  layers = data.layers;
  loadLayer();
});

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
