const fs = require('fs');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  const text = fs.readFileSync('assets/travel/doc.kml', 'utf8');
  const regex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  const places = [];
  let m;

  while ((m = regex.exec(text))) {
    const block = m[1];
    const name = /<name>([\s\S]*?)<\/name>/.exec(block)?.[1].trim() || 'Unknown';
    const coords = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(block)?.[1].trim();
    if (!coords) continue;
    const [lon, lat] = coords.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lon)) {
      places.push({ name, lat, lon });
    }
  }

  const batch = db.batch();
  places.forEach(p => {
    const ref = db.collection('travel').doc();
    batch.set(ref, p);
  });

  await batch.commit();
  console.log(`Imported ${places.length} places`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
