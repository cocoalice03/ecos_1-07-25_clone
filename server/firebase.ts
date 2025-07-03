
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let db: admin.firestore.Firestore;

try {
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (!admin.apps || admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }

    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } else {
    console.warn('⚠️ Firebase service account key not found. Using mock database for development.');
    // Create a mock db object so the app doesn't crash
    db = {
      listCollections: () => Promise.resolve([]),
      collection: () => ({
        doc: () => ({
          set: () => Promise.resolve(),
          get: () => Promise.resolve({ exists: false }),
          update: () => Promise.resolve(),
          delete: () => Promise.resolve()
        }),
        add: () => Promise.resolve({ id: 'mock-id' }),
        where: () => ({
          get: () => Promise.resolve({ empty: true, docs: [] })
        })
      })
    } as any;
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error);
  console.log('Using mock database for development.');
  // Create a mock db object so the app doesn't crash
  db = {
    listCollections: () => Promise.resolve([]),
    collection: () => ({
      doc: () => ({
        set: () => Promise.resolve(),
        get: () => Promise.resolve({ exists: false }),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve()
      }),
      add: () => Promise.resolve({ id: 'mock-id' }),
      where: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] })
      })
    })
  } as any;
}

export { db as firestore };
