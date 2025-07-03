// Firebase Auth supprimé
// Implémentez votre propre système d'authentification

export async function authenticateWithEmail(email: string) {
  try {
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

export function getStoredEmail() {
  return localStorage.getItem('userEmail');
}

export async function signOut() {
  try {
    localStorage.removeItem('userEmail');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    return { success: false, error };
  }
}