
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let db: admin.firestore.Firestore;

// En mode développement, utiliser directement la base de données mock
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Mode développement : utilisation de la base de données mock');
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
} else {
  // En production, essayer d'initialiser Firebase Admin SDK
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
      throw new Error('Firebase service account key not found in production');
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
    throw error; // En production, on ne veut pas continuer sans Firebase
  }
}

export { db as firestore };
