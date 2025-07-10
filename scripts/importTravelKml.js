const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Missing ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.warn(
    `FIRESTORE_EMULATOR_HOST is set to ${process.env.FIRESTORE_EMULATOR_HOST}`
  );
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (err) {
  console.error('Failed to initialize Firebase Admin SDK:', err.message);
  process.exit(1);
}

const db = admin.firestore();

// User that will own all imported placemarks
const DEFAULT_USER_ID = '6hWB9QquC1fV2XlX0ixm3Fnq0Sj2';

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
  try {
    const snap = await coll.get();
    await Promise.all(snap.docs.map(doc => doc.ref.delete()));
  } catch (err) {
    throw new Error(`Failed to clear collection ${coll.path}: ${err.message}`);
  }
}

async function importPlaces(places) {
  const batchSize = 400;
  let batch = db.batch();
  let count = 0;
  try {
    for (const place of places) {
      const ref = db
        .collection('users')
        .doc(DEFAULT_USER_ID)
        .collection('travel')
        .doc();
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
  } catch (err) {
    throw new Error(`Failed to import places: ${err.message}`);
  }
}

async function main() {
  const filePath = 'assets/travel/doc.kml';
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Unable to read ${filePath}:`, err.message);
    process.exit(1);
  }

  const places = parseKml(text);

  const collection = db
    .collection('users')
    .doc(DEFAULT_USER_ID)
    .collection('travel');

  await clearCollection(collection);
  await importPlaces(places);

  console.log(`Imported ${places.length} places into ${collection.path}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
