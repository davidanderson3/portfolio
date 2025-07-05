const fs = require('fs');
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBbet_bmwm8h8G5CqvmzrdAnc3AO-0IKa8",
  authDomain: "decision-maker-4e1d3.firebaseapp.com",
  projectId: "decision-maker-4e1d3",
  storageBucket: "decision-maker-4e1d3.firebasestorage.app",
  messagingSenderId: "727689864651",
  appId: "1:727689864651:web:0100c3894790b8c188c24e",
  measurementId: "G-7EJVQN0WT3"
};

firebase.initializeApp(firebaseConfig);

async function main() {
  const email = process.env.FIREBASE_EMAIL;
  const password = process.env.FIREBASE_PASSWORD;
  if (!email || !password) {
    console.error('FIREBASE_EMAIL and FIREBASE_PASSWORD env vars required');
    process.exit(1);
  }
  await firebase.auth().signInWithEmailAndPassword(email, password);
  const db = firebase.firestore();

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
