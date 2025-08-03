let layers = [];
let current = 0;
let locationId = '';
let finished = false;
let guessedThisLayer = false;

const map = L.map('map', { zoomControl:false, attributionControl:false }).setView([37,-95],3);

function styleFor(layer) {
  const name = layer.split('/').pop();
  const colors = {
    rivers: '#0ff',
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
    L.geoJSON(geo, {
      style: styleFor(layers[current]),
      pointToLayer: (feature, latlng) => {
        if (layers[current].includes('label')) {
          return L.marker(latlng).bindTooltip(feature.properties.name,{permanent:true});
        }
        return L.circleMarker(latlng, { radius:5, fillOpacity:1, color: styleFor(layers[current]).color });
      }
    }).addTo(map);
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

const guess = document.getElementById('guess');
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
