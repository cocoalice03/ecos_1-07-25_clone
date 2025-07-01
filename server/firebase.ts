import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let db: admin.firestore.Firestore;

try {
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }

    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } else {
    console.warn('⚠️ Firebase service account key not found at firebase-service-account.json. Firestore will not be available.');
    // Create a mock db object so the app doesn't crash
    db = {} as admin.firestore.Firestore;
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error);
  // Create a mock db object so the app doesn't crash
  db = {} as admin.firestore.Firestore;
}


export { db as firestore };
