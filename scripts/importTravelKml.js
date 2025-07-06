const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function parseKml(text) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const obj = parser.parse(text);
  const placemarks = obj.kml.Document.Placemark || [];
  return placemarks.map(pm => {
    const coords = pm.Point?.coordinates?.trim();
    const [lon, lat] = coords ? coords.split(',').map(Number) : [NaN, NaN];
    const extended = {};
    if (pm.ExtendedData && pm.ExtendedData.Data) {
      const dataArr = Array.isArray(pm.ExtendedData.Data) ? pm.ExtendedData.Data : [pm.ExtendedData.Data];
      dataArr.forEach(d => {
        if (d['@_name']) extended[d['@_name']] = d.value || '';
      });
    }
    return {
      name: pm.name?.trim() || 'Unknown',
      description: pm.description || '',
      styleUrl: pm.styleUrl || '',
      lat,
      lon,
      ...extended
    };
  }).filter(p => !Number.isNaN(p.lat) && !Number.isNaN(p.lon));
}

async function clearCollection(coll) {
  const snap = await coll.get();
  await Promise.all(snap.docs.map(doc => doc.ref.delete()));
}

async function importPlaces(places) {
  const batchSize = 400;
  let batch = db.batch();
  let count = 0;
  for (const place of places) {
    const ref = db.collection('travel').doc();
    batch.set(ref, place);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % batchSize !== 0) {
    await batch.commit();
  }
}

async function main() {
  const text = fs.readFileSync('assets/travel/doc.kml', 'utf8');
  const places = parseKml(text);

  await clearCollection(db.collection('travel'));
  await importPlaces(places);

  console.log(`Imported ${places.length} places`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
