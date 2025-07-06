import { db } from './auth.js';

let mapInitialized = false;
let travelData = [];
let rotationX = 0;
let rotationY = 0;
let canvas, ctx;
let radius = 1;

function latLonToCartesian(lat, lon, r) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return { x, y, z };
}

function project({ x, y, z }) {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  let nx = x * cosY + z * sinY;
  let nz = -x * sinY + z * cosY;

  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  let ny = y * cosX - nz * sinX;
  nz = y * sinX + nz * cosX;

  const fov = canvas.width / 2;
  const scale = fov / (fov + nz);
  return {
    x: nx * scale + canvas.width / 2,
    y: ny * scale + canvas.height / 2,
    z: nz
  };
}

function drawGraticule() {
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 0.5;
  for (let lat = -80; lat <= 80; lat += 20) {
    ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 5) {
      const { x, y } = project(latLonToCartesian(lat, lon, radius));
      if (lon === -180) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let lon = -180; lon <= 180; lon += 20) {
    ctx.beginPath();
    for (let lat = -90; lat <= 90; lat += 5) {
      const { x, y } = project(latLonToCartesian(lat, lon, radius));
      if (lat === -90) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawPoints() {
  ctx.fillStyle = 'red';
  travelData.forEach(p => {
    const pt = project(latLonToCartesian(p.lat, p.lon, radius));
    if (pt.z > -1) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

export async function initTravelPanel() {
  const panel = document.getElementById('travelPanel');
  if (!panel || mapInitialized) return;
  mapInitialized = true;

  canvas = document.getElementById('travelMap');
  ctx = canvas.getContext('2d');
  radius = Math.min(canvas.width, canvas.height) / 2 - 20;
  const list = document.getElementById('travelList');

  try {
    const snap = await db.collection('travel').get();
    travelData = snap.docs.map(doc => doc.data());
    if (!travelData.length) {
      throw new Error('No travel docs');
    }
    localStorage.setItem('travelData', JSON.stringify(travelData));
  } catch (err) {
    console.error('Failed to load travel data', err);
    const cached = localStorage.getItem('travelData');
    travelData = cached ? JSON.parse(cached) : [];
  }

  function renderFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGraticule();
    drawPoints();
    requestAnimationFrame(renderFrame);
  }

  list.innerHTML = '';
  travelData.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})`;
    list.append(li);
  });

  document.getElementById('addPlaceBtn').addEventListener('click', async () => {
    const name = prompt('Place name:');
    const lat = parseFloat(prompt('Latitude:'));
    const lon = parseFloat(prompt('Longitude:'));
    if (!name || Number.isNaN(lat) || Number.isNaN(lon)) return;
    const place = { name, lat, lon };
    travelData.push(place);
    localStorage.setItem('travelData', JSON.stringify(travelData));
    try {
      await db.collection('travel').add(place);
    } catch (err) {
      console.error('Failed to save place to Firestore', err);
    }
    list.innerHTML = '';
    travelData.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.name} (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})`;
      list.append(li);
    });
  });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('mousedown', e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    rotationY += dx * 0.005;
    rotationX += dy * 0.005;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('mouseup', () => { dragging = false; });
  canvas.addEventListener('mouseleave', () => { dragging = false; });

  renderFrame();
}

// legacy parser kept for potential future imports
function parseKml(text) {
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
