
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let db: admin.firestore.Firestore;

// En mode développement, utiliser directement la base de données mock
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Mode développement : utilisation de la base de données mock');
  
  // Scénarios mock pour le développement
  const mockScenarios = [
    {
      id: '1',
      title: 'Consultation d\'urgence - Douleur thoracique',
      description: 'Patient de 45 ans présentant une douleur thoracique aiguë. Évaluation rapide et prise en charge appropriée requises.',
      patientPrompt: 'Vous êtes un patient de 45 ans présentant une douleur thoracique depuis 2 heures. Vous êtes anxieux et inquiet.',
      evaluationCriteria: { communication: 20, anamnese: 25, examen_physique: 25, raisonnement_clinique: 30 },
      createdBy: 'mock-teacher@example.com',
      createdAt: new Date('2025-01-01'),
      pineconeIndex: null
    },
    {
      id: '2',
      title: 'Examen de l\'épaule douloureuse',
      description: 'Patient sportif avec douleur à l\'épaule suite à une chute. Examen clinique systématique nécessaire.',
      patientPrompt: 'Vous êtes un sportif de 28 ans avec une douleur à l\'épaule droite depuis une chute il y a 3 jours.',
      evaluationCriteria: { communication: 15, anamnese: 20, examen_physique: 35, raisonnement_clinique: 30 },
      createdBy: 'mock-teacher@example.com',
      createdAt: new Date('2025-01-02'),
      pineconeIndex: null
    },
    {
      id: '3',
      title: 'Traumatisme du poignet',
      description: 'Évaluation d\'un traumatisme du poignet chez un adolescent. Diagnostic différentiel et prise en charge.',
      patientPrompt: 'Vous êtes un adolescent de 16 ans qui s\'est blessé le poignet en faisant du skateboard.',
      evaluationCriteria: { communication: 20, anamnese: 25, examen_physique: 30, raisonnement_clinique: 25 },
      createdBy: 'mock-teacher@example.com',
      createdAt: new Date('2025-01-03'),
      pineconeIndex: null
    }
  ];

  db = {
    listCollections: () => Promise.resolve([]),
    collection: (collectionName: string) => ({
      doc: (docId?: string) => ({
        set: () => Promise.resolve(),
        get: () => {
          if (collectionName === 'ecos_scenarios' && docId) {
            const scenario = mockScenarios.find(s => s.id === docId);
            return Promise.resolve({ 
              exists: !!scenario, 
              id: docId,
              data: () => scenario
            });
          }
          return Promise.resolve({ exists: false });
        },
        update: () => Promise.resolve(),
        delete: () => Promise.resolve()
      }),
      add: () => Promise.resolve({ id: 'mock-id' }),
      where: (field: string, operator: string, value: any) => ({
        get: () => {
          if (collectionName === 'ecos_scenarios') {
            return Promise.resolve({ 
              empty: false, 
              docs: mockScenarios.map(scenario => ({
                id: scenario.id,
                data: () => scenario
              }))
            });
          }
          if (collectionName === 'users') {
            // Simuler la recherche d'utilisateur par email
            return Promise.resolve({ empty: true, docs: [] });
          }
          return Promise.resolve({ empty: true, docs: [] });
        },
        limit: (limitValue: number) => ({
          get: () => {
            if (collectionName === 'users') {
              // Simuler la recherche d'utilisateur par email avec limite
              return Promise.resolve({ empty: true, docs: [] });
            }
            return Promise.resolve({ empty: true, docs: [] });
          }
        }),
        orderBy: (field: string, direction?: string) => ({
          get: () => {
            if (collectionName === 'ecos_scenarios') {
              return Promise.resolve({ 
                empty: false, 
                docs: mockScenarios.map(scenario => ({
                  id: scenario.id,
                  data: () => scenario
                }))
              });
            }
            return Promise.resolve({ empty: true, docs: [] });
          }
        })
      }),
      orderBy: (field: string, direction?: string) => ({
        get: () => {
          if (collectionName === 'ecos_scenarios') {
            return Promise.resolve({ 
              empty: false, 
              docs: mockScenarios.map(scenario => ({
                id: scenario.id,
                data: () => scenario
              }))
            });
          }
          return Promise.resolve({ empty: true, docs: [] });
        }
      }),
      get: () => {
        if (collectionName === 'ecos_scenarios') {
          return Promise.resolve({ 
            empty: false, 
            docs: mockScenarios.map(scenario => ({
              id: scenario.id,
              data: () => scenario
            }))
          });
        }
        return Promise.resolve({ empty: true, docs: [] });
      }
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
