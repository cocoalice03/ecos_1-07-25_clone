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

// En mode développement, utiliser les émulateurs Firebase
if (import.meta.env.DEV) {
  console.log('🔧 Mode développement : utilisation des émulateurs Firebase');
  
  // Connecter aux émulateurs seulement si pas déjà connectés
  try {
    // Utiliser l'émulateur Auth sur le port 9099
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log('✅ Émulateur Firebase Auth connecté');
  } catch (error) {
    console.log('ℹ️ Émulateur Firebase Auth déjà connecté ou non disponible');
  }
  
  try {
    // Utiliser l'émulateur Firestore sur le port 8080
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✅ Émulateur Firebase Firestore connecté');
  } catch (error) {
    console.log('ℹ️ Émulateur Firebase Firestore déjà connecté ou non disponible');
  }
} else {
  console.log('🔥 Mode production : utilisation des services Firebase');
}

export default apppp;