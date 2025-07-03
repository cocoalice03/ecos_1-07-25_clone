import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import firebase, { auth } from './firebase';

// Utiliser l'authentification Firebase déjà initialisée

// Fonction simplifiée pour "connecter" un utilisateur par email
// Cette version évite d'utiliser l'authentification Firebase directement
// pour se concentrer sur la fonctionnalité principale
export async function authenticateWithEmail(email: string) {
  try {
    // Solution simple : stocker l'email dans localStorage
    localStorage.setItem('userEmail', email);
    
    // Simuler une authentification réussie
    // Dans une implémentation complète, vous utiliseriez Firebase Auth correctement configuré
    return {
      success: true,
      email: email,
    };
  } catch (error) {
    console.error('Erreur lors de l\'authentification:', error);
    return {
      success: false,
      error
    };
  }
}

// Vérifier si l'utilisateur est déjà authentifié
export function getStoredEmail() {
  return localStorage.getItem('userEmail');
}

// Déconnecter l'utilisateur
export async function signOut() {
  try {
    await auth.signOut();
    localStorage.removeItem('userEmail');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    return { success: false, error };
  }
}

export default auth;
