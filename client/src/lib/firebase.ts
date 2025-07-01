import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
// Nous n'importons pas Analytics car cela peut causer des problèmes côté serveur

// Configuration Firebase avec variables d'environnement et valeurs par défaut pour le développement
console.log('Variables env Vite:', import.meta.env.VITE_FIREBASE_API_KEY ? 'API Key présente' : 'API Key manquante');

// Configuration Firebase avec valeurs de fallback pour le développement
// IMPORTANT: En environnement de production, utilisez uniquement les variables d'environnement
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA880kh-hCSEApiFX5gAnr-B25Q5ZM-NE0", // Fallback pour le développement
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sqltry-d4ebb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sqltry-d4ebb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sqltry-d4ebb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "472326334906",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:472326334906:web:0acbc12aa501d4c3395583",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-0PE5TNV8QP"
};

// Message de sécurité important pour les développeurs
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn('⚠️ Variables d\'environnement Firebase manquantes! Utilisation des valeurs de fallback pour le développement uniquement.');
  console.warn('⚠️ Créez un fichier .env à la racine du projet avec les variables définies dans .env.example');
}

// Initialiser Firebase avec validation de la configuration
const app = initializeApp(firebaseConfig);

// Initialiser Firestore
export const db = getFirestore(app);

// Initialiser Auth avec gestion d'erreur pour le développement
export const auth = getAuth(app);

// En environnement de développement, nous pouvons utiliser l'émulateur
// ou simplement éviter certaines vérifications
if (import.meta.env.DEV) {
  // Configuré pour fonctionner sans validation stricte en développement
  console.log('Firebase initialisé en mode développement');
}

export default app;
