import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Configuration Firebase avec les vraies données du projet
const firebaseConfig = {
  apiKey: "AIzaSyA880kh-hCSEApiFX5gAnr-B25Q5ZM-NE0",
  authDomain: "sqltry-d4ebb.firebaseapp.com",
  databaseURL: "https://sqltry-d4ebb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sqltry-d4ebb",
  storageBucket: "sqltry-d4ebb.firebasestorage.app",
  messagingSenderId: "472326334906",
  appId: "1:472326334906:web:43e734faf2ffcd0e395583",
  measurementId: "G-G9Y5PML2RJ"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser Firestore
export const db = getFirestore(app);

// Initialiser Auth
export const auth = getAuth(app);

// Initialiser Analytics
export const analytics = getAnalytics(app);

// En mode développement sur Replit, ne pas utiliser les émulateurs Firebase
// car ils causent des problèmes de contenu mixte (HTTP/HTTPS)
if (import.meta.env.DEV) {
  console.log('🔧 Mode développement : Firebase configuré sans émulateurs');
  console.log('ℹ️ Les émulateurs Firebase sont désactivés sur Replit pour éviter les erreurs de contenu mixte');
} else {
  console.log('🔥 Mode production : utilisation des services Firebase');
}

export default app;