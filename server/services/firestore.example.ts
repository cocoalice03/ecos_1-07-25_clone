import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase.service';

/**
 * Exemple de service pour interagir avec Firestore
 * Ce service montre comment adapter votre code existant pour utiliser Firebase
 */
export class FirestoreExampleService {
  
  /**
   * Ajouter un utilisateur à la collection "users"
   */
  async addUser(userData: any) {
    try {
      const docRef = await addDoc(collection(db, "users"), userData);
      console.log("Utilisateur ajouté avec ID: ", docRef.id);
      return { id: docRef.id, ...userData };
    } catch (e) {
      console.error("Erreur lors de l'ajout de l'utilisateur: ", e);
      throw e;
    }
  }

  /**
   * Récupérer un utilisateur par email
   */
  async getUserByEmail(email: string) {
    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      // Prendre le premier utilisateur correspondant
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (e) {
      console.error("Erreur lors de la recherche de l'utilisateur: ", e);
      throw e;
    }
  }

  /**
   * Ajouter un échange (question-réponse)
   */
  async addExchange(exchangeData: any) {
    try {
      const docRef = await addDoc(collection(db, "exchanges"), {
        ...exchangeData,
        timestamp: new Date()
      });
      return { id: docRef.id, ...exchangeData };
    } catch (e) {
      console.error("Erreur lors de l'ajout de l'échange: ", e);
      throw e;
    }
  }

  /**
   * Récupérer les échanges d'un utilisateur
   */
  async getExchangesByEmail(email: string) {
    try {
      const q = query(
        collection(db, "exchanges"), 
        where("email", "==", email)
      );
      const querySnapshot = await getDocs(q);
      
      const exchanges: any[] = [];
      querySnapshot.forEach((doc) => {
        exchanges.push({ id: doc.id, ...doc.data() });
      });
      
      return exchanges;
    } catch (e) {
      console.error("Erreur lors de la récupération des échanges: ", e);
      throw e;
    }
  }

  /**
   * Exemple pour les scénarios ECOS
   */
  async addEcosScenario(scenarioData: any) {
    try {
      const docRef = await addDoc(collection(db, "ecos_scenarios"), {
        ...scenarioData,
        createdAt: new Date()
      });
      return { id: docRef.id, ...scenarioData };
    } catch (e) {
      console.error("Erreur lors de l'ajout du scénario ECOS: ", e);
      throw e;
    }
  }

  /**
   * Récupérer tous les scénarios ECOS
   */
  async getAllEcosScenarios() {
    try {
      const querySnapshot = await getDocs(collection(db, "ecos_scenarios"));
      
      const scenarios: any[] = [];
      querySnapshot.forEach((doc) => {
        scenarios.push({ id: doc.id, ...doc.data() });
      });
      
      return scenarios;
    } catch (e) {
      console.error("Erreur lors de la récupération des scénarios: ", e);
      throw e;
    }
  }
}

export default new FirestoreExampleService();
