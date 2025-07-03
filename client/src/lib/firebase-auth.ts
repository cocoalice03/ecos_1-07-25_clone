import { auth } from './firebase';

// Fonction simplifiée pour "connecter" un utilisateur par email
// En mode développement, utilise localStorage pour éviter les erreurs API
export async function authenticateWithEmail(email: string) {
  try {
    // En mode développement, utiliser localStorage simple
    if (import.meta.env.DEV) {
      localStorage.setItem('userEmail', email);
      console.log('🔧 Mode développement : authentification simulée pour', email);
      return {
        success: true,
        email: email,
      };
    }
    
    // En production, utiliser Firebase Auth
    // (pour l'instant, utiliser aussi localStorage)
    localStorage.setItem('userEmail', email);
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
    // En mode développement, nettoyer seulement localStorage
    if (import.meta.env.DEV) {
      localStorage.removeItem('userEmail');
      console.log('🔧 Mode développement : déconnexion simulée');
      return { success: true };
    }
    
    // En production, utiliser Firebase Auth
    await auth.signOut();
    localStorage.removeItem('userEmail');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    localStorage.removeItem('userEmail'); // Nettoyer quand même
    return { success: false, error };
  }
}

export default auth;
