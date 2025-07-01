/**
 * Ce fichier est un exemple qui montre comment migrer
 * d'une base de données PostgreSQL à Firestore.
 * Il n'est pas destiné à être exécuté directement.
 */

import { db } from './firebase.service';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';

/**
 * Exemple de structure pour les données Firestore
 * 
 * Contrairement à PostgreSQL qui utilise des tables relationnelles,
 * Firestore est une base de données NoSQL orientée documents.
 * 
 * Voici comment adapter votre modèle de données :
 */

// Exemple : Structure des utilisateurs
const userExample = {
  id: 'user_id', // ID personnalisé ou généré par Firestore
  email: 'utilisateur@example.com',
  firstName: 'Prénom',
  lastName: 'Nom',
  profileImageUrl: 'https://example.com/image.jpg',
  createdAt: new Date(),
  updatedAt: new Date()
};

// Exemple : Structure des échanges
const exchangeExample = {
  id: 'exchange_id',
  email: 'utilisateur@example.com',
  question: 'Question posée',
  response: 'Réponse du système',
  timestamp: new Date()
};

// Exemple : Structure des scénarios ECOS
const ecosScenarioExample = {
  id: 'scenario_id',
  title: 'Titre du scénario',
  description: 'Description détaillée',
  patientPrompt: 'Instructions pour le patient',
  evaluationCriteria: {
    criteria1: { 
      description: 'Description du critère 1',
      maxScore: 5
    },
    criteria2: { 
      description: 'Description du critère 2',
      maxScore: 10
    }
  },
  imageUrl: 'https://example.com/scenario.jpg',
  createdBy: 'email@creator.com',
  createdAt: new Date()
};

// Exemple : Structure des sessions ECOS
// Notez que nous utilisons des références à d'autres documents
const ecosSessionExample = {
  id: 'session_id',
  scenarioId: 'scenario_id', // Référence à un scénario
  studentEmail: 'etudiant@example.com',
  trainingSessionId: 'training_id', // Référence à une session de formation
  startTime: new Date(),
  endTime: null, // Null si la session est en cours
  status: 'in_progress',
  
  // Imbrication des évaluations (au lieu d'avoir une table séparée)
  evaluations: [
    {
      criterionId: 'criteria1',
      score: 4,
      feedback: 'Bon travail sur ce critère'
    },
    {
      criterionId: 'criteria2',
      score: 7,
      feedback: 'Des améliorations possibles'
    }
  ],
  
  // Imbrication des messages (au lieu d'avoir une table séparée)
  messages: [
    {
      role: 'user',
      content: 'Message de l'utilisateur',
      timestamp: new Date()
    },
    {
      role: 'assistant',
      content: 'Réponse de l'assistant',
      timestamp: new Date()
    }
  ]
};

/**
 * Fonction d'exemple pour migrer des données PostgreSQL vers Firestore
 */
async function migrateUsersExample(postgresUsers: any[]) {
  const batch = writeBatch(db);
  
  for (const user of postgresUsers) {
    // Créer une référence de document avec un ID spécifique
    const userRef = doc(collection(db, "users"), user.id);
    
    // Préparer les données pour Firestore
    const firestoreUser = {
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      profileImageUrl: user.profileImageUrl || null,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date()
    };
    
    // Ajouter l'opération au batch
    batch.set(userRef, firestoreUser);
  }
  
  // Exécuter toutes les opérations en une seule transaction
  try {
    await batch.commit();
    console.log(`Migré ${postgresUsers.length} utilisateurs vers Firestore`);
  } catch (e) {
    console.error("Erreur lors de la migration des utilisateurs:", e);
  }
}

/**
 * Points importants pour la migration:
 * 
 * 1. Dénormalisation: Firestore fonctionne mieux avec des données dénormalisées
 *    - Plutôt que d'utiliser des clés étrangères, vous pouvez imbriquer des données
 *    - Pour les relations complexes, vous pouvez stocker des références d'ID
 * 
 * 2. Collections et sous-collections:
 *    - Utilisez des collections pour les principaux types de données
 *    - Utilisez des sous-collections pour les données liées à un document spécifique
 * 
 * 3. Requêtes:
 *    - Les requêtes Firestore sont différentes des requêtes SQL
 *    - Vous ne pouvez pas faire de jointures comme en SQL
 *    - Concevez votre structure de données en fonction des requêtes que vous prévoyez d'effectuer
 * 
 * 4. Limites:
 *    - Un document Firestore ne peut pas dépasser 1 Mo
 *    - Vous ne pouvez pas avoir plus de 20 000 documents dans une requête
 */
