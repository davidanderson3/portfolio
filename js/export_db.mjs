import admin from 'firebase-admin';
import fs from 'fs';

// Load your service account key
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const uid = '6hWB9QquC1fV2XlX0ixm3Fnq0Sj2';

async function exportUserDecisions() {
    const docRef = db.collection('decisions').doc(uid);
    const doc = await docRef.get();

    if (!doc.exists) {
        console.error('No document found for user:', uid);
        return;
    }

    const data = doc.data();
    fs.writeFileSync(`decisions-backup-${uid}.json`, JSON.stringify(data, null, 2));
    console.log('✅ Backup saved');
}

exportUserDecisions();
