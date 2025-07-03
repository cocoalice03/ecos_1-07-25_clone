import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Configuration Firebase avec émulateur pour le développement
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser Firestore
export const db = getFirestore(app);

// Initialiser Auth
export const auth = getAuth(app);

// En mode développement sur Replit, ne pas utiliser les émulateurs Firebase
// car ils causent des problèmes de contenu mixte (HTTP/HTTPS)
if (import.meta.env.DEV) {
  console.log('🔧 Mode développement : Firebase configuré sans émulateurs');
  console.log('ℹ️ Les émulateurs Firebase sont désactivés sur Replit pour éviter les erreurs de contenu mixte');
} else {
  console.log('🔥 Mode production : utilisation des services Firebase');
}

export default app;