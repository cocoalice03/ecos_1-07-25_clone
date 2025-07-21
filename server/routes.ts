import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { db, users, ecosScenarios, ecosSessions, ecosMessages, trainingSessions, trainingSessionStudents, trainingSessionScenarios } from './db';
import { eq, and } from 'drizzle-orm';
import { scenarioSyncService } from './services/scenario-sync.service';

// Admin emails authorized to access admin features
const ADMIN_EMAILS: string[] = [
  'cherubindavid@gmail.com', 
  'colombemadoungou@gmail.com', 
  'colombemadoungou.com', // Accept both formats for debugging
  'romain.guillevic@gmail.com', 
  'romainguillevic@gmail.com'
];

// Middleware to check admin authorization
function isAdminAuthorized(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedAdminEmails = ADMIN_EMAILS.map(adminEmail => adminEmail.toLowerCase().trim());
  return normalizedAdminEmails.includes(normalizedEmail);
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize database and data
  setImmediate(async () => {
    try {
      console.log('🔧 Testing database connection...');
      const { databaseInitService } = await import('./services/database-init.service');
      const connected = await databaseInitService.testConnection();
      
      if (connected) {
        console.log('📊 Attempting to sync scenarios from Pinecone...');
        await scenarioSyncService.syncScenariosFromPinecone();
        console.log('✅ Pinecone sync completed');
      } else {
        console.log('⚠️ Database not available, using fallback scenarios only');
      }
    } catch (error) {
      console.log('⚠️ Initialization failed, using fallback scenarios for demonstration');
    }
  });

  // In-memory user storage for demonstration
  const inMemoryUsers = new Map<string, { userId: string; createdAt: Date }>();

  async function findOrCreateStudent(email: string): Promise<{ userId: string; isNewUser: boolean }> {
    try {
      // Try database first
      try {
        const existingUsers = await db
          .select()
          .from(users)
          .where(eq(users.email, email));

        if (existingUsers.length > 0) {
          return { userId: existingUsers[0].id, isNewUser: false };
        }

        // Create new user with generated ID
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(users).values({
          id: userId,
          email: email,
        });

        return { userId, isNewUser: true };
      } catch (dbError) {
        console.log('Database not available, using in-memory storage');
        
        // Fallback to in-memory storage
        if (inMemoryUsers.has(email)) {
          const user = inMemoryUsers.get(email)!;
          return { userId: user.userId, isNewUser: false };
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        inMemoryUsers.set(email, { userId, createdAt: new Date() });
        return { userId, isNewUser: true };
      }
    } catch (error) {
      console.error('Error in findOrCreateStudent:', error);
      throw error;
    }
  }

  // Route to sync scenarios from Pinecone
  app.post("/api/admin/sync-scenarios", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      await scenarioSyncService.syncScenariosFromPinecone();
      res.status(200).json({ message: "Synchronisation des scénarios terminée avec succès" });
    } catch (error: any) {
      console.error("Error syncing scenarios:", error);
      res.status(500).json({ message: "Erreur lors de la synchronisation des scénarios" });
    }
  });

  // Route to test direct database connection and fetch scenarios
  app.get("/api/admin/test-db", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      const { alternativeSupabaseService } = await import('./services/alternative-supabase.service');
      
      console.log('🔧 Testing alternative Supabase connection...');
      await alternativeSupabaseService.testConnection();
      
      const scenarios = await alternativeSupabaseService.getScenarios();
      
      res.status(200).json({ 
        connected: true,
        scenarios,
        count: scenarios.length,
        message: `Connexion Supabase réussie - ${scenarios.length} scénarios trouvés`
      });
      
    } catch (error: any) {
      console.error("Error connecting to Supabase:", error);
      res.status(500).json({ 
        message: "Erreur de connexion à la base de données Supabase",
        error: error.message,
        connected: false
      });
    }
  });

  // Route to get available scenarios for students
  app.get("/api/student/available-scenarios", async (req: Request, res: Response) => {
    try {
      console.log('🔧 Fetching student scenarios from database only...');
      const scenarios = await scenarioSyncService.getAvailableScenarios();
      
      res.status(200).json({ 
        scenarios,
        connected: true,
        source: 'database'
      });
      
    } catch (error: any) {
      console.error("Error fetching student scenarios:", error);
      res.status(500).json({ 
        message: "Erreur de connexion à la base de données",
        error: error.message,
        connected: false
      });
    }
  });

  // Route to get scenarios for teacher dashboard
  app.get("/api/teacher/scenarios", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      console.log('🔧 Fetching teacher scenarios from database only...');
      const scenarios = await scenarioSyncService.getAvailableScenarios();
      
      res.status(200).json({ 
        scenarios,
        connected: true,
        source: 'database'
      });
      
    } catch (error: any) {
      console.error("Error fetching teacher scenarios:", error);
      res.status(500).json({ 
        message: "Erreur de connexion à la base de données",
        error: error.message,
        connected: false
      });
    }
  });

  // Route to get dashboard stats for teachers
  app.get("/api/teacher/dashboard", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      let stats = {
        totalScenarios: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalStudents: 0
      };

      try {
        // Try to get real stats from database
        const scenarios = await scenarioSyncService.getAvailableScenarios();
        stats.totalScenarios = scenarios.length;
      } catch (dbError) {
        // Use fallback data
        const { fallbackScenariosService } = await import('./services/fallback-scenarios.service');
        const scenarios = await fallbackScenariosService.getAvailableScenarios();
        stats.totalScenarios = scenarios.length;
        stats.activeSessions = 2; // Sample data
        stats.completedSessions = 15; // Sample data  
        stats.totalStudents = 8; // Sample data
      }

      res.status(200).json(stats);
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des statistiques" });
    }
  });

  // API route to create or verify a student account
  app.post("/api/student", async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email("Format d'email invalide"),
    });

    try {
      const { email } = schema.parse(req.body);
      const { userId, isNewUser } = await findOrCreateStudent(email);
      res.status(200).json({ 
        message: "Compte étudiant traité avec succès", 
        userId, 
        isNewUser 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Error in /api/student:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // API route to start a simulation session
  app.post("/api/session/start", async (req: Request, res: Response) => {
    const schema = z.object({
      student_email: z.string().email(),
      scenario_id: z.string(),
    });

    try {
      const { student_email, scenario_id } = schema.parse(req.body);

      const userSnapshot = await db.collection('users').where('email', '==', student_email).limit(1).get();
      if (userSnapshot.empty) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const userId = userSnapshot.docs[0].id;

      // TODO: Verify student has access to this scenario via their training sessions

      const sessionRef = await db.collection('ecos_sessions').add({
        student_id: userId,
        scenario_id,
        status: 'started',
        start_time: new Date(),
      });

      const scenarioDoc = await db.collection('ecos_scenarios').doc(scenario_id).get();
      if (!scenarioDoc.exists) {
        return res.status(404).json({ message: "Scénario non trouvé" });
      }

      res.status(200).json({
        session_id: sessionRef.id,
        patient_prompt: scenarioDoc.data()?.patient_prompt,
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Error in /api/session/start:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // API route to get scenarios for a student
  app.get("/api/student/scenarios", async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
    });

    try {
      const { email } = schema.parse(req.query);

      const userSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
      if (userSnapshot.empty) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const userId = userSnapshot.docs[0].id;

      const trainingSessionLinks = await db.collection('training_session_students').where('user_id', '==', userId).get();
      if (trainingSessionLinks.empty) {
        return res.status(200).json({ scenarios: [], training_sessions: [] });
      }
      const trainingSessionIds = trainingSessionLinks.docs.map(doc => doc.data().training_session_id);

      if (trainingSessionIds.length === 0) {
          return res.status(200).json({ scenarios: [], training_sessions: [] });
      }

      const scenarioLinks = await db.collection('training_session_scenarios').where('training_session_id', 'in', trainingSessionIds).get();
      const scenarioIds = [...new Set(scenarioLinks.docs.map(doc => doc.data().scenario_id))];

      if (scenarioIds.length === 0) {
        return res.status(200).json({ scenarios: [], training_sessions: [] });
      }

      const scenariosSnapshot = await db.collection('ecos_scenarios').where(FieldPath.documentId(), 'in', scenarioIds).get();
      const scenarios = scenariosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // TODO: Fetch training session details as well to return to the client

      res.status(200).json({ scenarios, training_sessions: [] });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Error in /api/student/scenarios:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // Admin health check for Firestore
  app.get("/api/admin/health", async (req: Request, res: Response) => {
    try {
      await db.listCollections();
      res.status(200).json({ status: 'ok', message: 'Firestore connection is healthy.' });
    } catch (error: any) {
      console.error('Firestore health check failed:', error);
      res.status(500).json({ status: 'error', message: 'Firestore connection failed.', error: error.message });
    }
  });

  // Update a training session
  app.put("/api/training-sessions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        email: z.string().email(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        scenarioIds: z.array(z.string()).optional(),
        studentEmails: z.array(z.string().email()).optional(),
      });

      const { email, ...updateData } = updateSchema.parse(req.body);

      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      const sessionRef = db.collection('training_sessions').doc(id);

      await db.runTransaction(async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists || sessionDoc.data()?.created_by !== email) {
          throw new Error("Session de formation non trouvée ou accès non autorisé");
        }

        const updateFields: any = {};
        if (updateData.title) updateFields.title = updateData.title;
        if (updateData.description !== undefined) updateFields.description = updateData.description;
        if (updateData.startDate) updateFields.start_date = new Date(updateData.startDate);
        if (updateData.endDate) updateFields.end_date = new Date(updateData.endDate);

        if (Object.keys(updateFields).length > 0) {
          transaction.update(sessionRef, updateFields);
        }

        if (updateData.scenarioIds) {
          const scenariosRef = db.collection('training_session_scenarios');
          const existingScenariosQuery = scenariosRef.where('training_session_id', '==', id);
          const existingScenariosSnapshot = await transaction.get(existingScenariosQuery);
          existingScenariosSnapshot.docs.forEach(doc => transaction.delete(doc.ref));

          if (updateData.scenarioIds.length > 0) {
            updateData.scenarioIds.forEach(scenarioId => {
              const newScenarioLinkRef = scenariosRef.doc();
              transaction.set(newScenarioLinkRef, {
                training_session_id: id,
                scenario_id: scenarioId,
              });
            });
          }
        }

        if (updateData.studentEmails && updateData.studentEmails.length > 0) {
          const studentsRef = db.collection('training_session_students');
          const existingStudentsQuery = studentsRef.where('training_session_id', '==', id);
          const existingStudentsSnapshot = await transaction.get(existingStudentsQuery);
          const existingUserIds = new Set(existingStudentsSnapshot.docs.map(doc => doc.data().user_id));

          const usersToQuery = updateData.studentEmails;
          const usersSnapshot = await db.collection('users').where('email', 'in', usersToQuery).get();
          const userEmailToIdMap = new Map(usersSnapshot.docs.map(doc => [doc.data().email, doc.id]));

          updateData.studentEmails.forEach(studentEmail => {
            const userId = userEmailToIdMap.get(studentEmail);
            if (userId && !existingUserIds.has(userId)) {
              const newStudentLinkRef = studentsRef.doc();
              transaction.set(newStudentLinkRef, {
                training_session_id: id,
                user_id: userId,
              });
            }
          });
        }
      });

      const updatedSession = await sessionRef.get();
      return res.status(200).json({ 
        message: "Session de formation mise à jour avec succès",
        trainingSession: { id: updatedSession.id, ...updatedSession.data() }
      });

    } catch (error: any) {
      console.error("Error updating training session:", error);
      if (error.message.includes("non trouvée")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: "Erreur lors de la mise à jour de la session de formation" });
    }
  });

  // Delete a training session
  app.delete("/api/training-sessions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const email = (req.query.email || req.body.email) as string;

      if (!email || !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      const sessionRef = db.collection('training_sessions').doc(id);
      
      await db.runTransaction(async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists || sessionDoc.data()?.created_by !== email) {
          throw new Error("Session de formation non trouvée ou accès non autorisé");
        }

        const scenariosQuery = db.collection('training_session_scenarios').where('training_session_id', '==', id);
        const studentsQuery = db.collection('training_session_students').where('training_session_id', '==', id);
        
        const [scenariosSnapshot, studentsSnapshot] = await Promise.all([
            transaction.get(scenariosQuery),
            transaction.get(studentsQuery)
        ]);

        scenariosSnapshot.docs.forEach(doc => transaction.delete(doc.ref));
        studentsSnapshot.docs.forEach(doc => transaction.delete(doc.ref));

        transaction.delete(sessionRef);
      });

      return res.status(200).json({ message: "Session de formation supprimée avec succès" });

    } catch (error: any) {
      console.error("Error deleting training session:", error);
       if (error.message.includes("non trouvée")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: "Erreur lors de la suppression de la session de formation" });
    }
  });

  // Get available scenarios for a student
  app.get("/api/student/available-scenarios", async (req: Request, res: Response) => {
    const schema = z.object({ email: z.string().email() });
    try {
      const { email } = schema.parse(req.query);

      if (isAdminAuthorized(email)) {
        const allScenariosSnapshot = await db.collection('ecos_scenarios').orderBy('createdAt').get();
        const allScenarios = allScenariosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ 
          scenarios: allScenarios,
          message: "Tous les scénarios disponibles (mode admin)"
        });
      }

      const { userId } = await findOrCreateStudent(email);
      
      const now = new Date();
      const trainingSessionLinks = await db.collection('training_session_students').where('user_id', '==', userId).get();
      const trainingSessionIds = trainingSessionLinks.docs.map(doc => doc.data().training_session_id);

      if (trainingSessionIds.length === 0) {
        return res.status(200).json({ scenarios: [], training_sessions: [], message: "Aucune session de formation active" });
      }

      const activeSessionsQuery = db.collection('training_sessions')
        .where(FieldPath.documentId(), 'in', trainingSessionIds)
        .where('start_date', '<=', now);

      const activeSessionsSnapshot = await activeSessionsQuery.get();
      const activeAndValidSessions = activeSessionsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as { id: string, end_date: any, [key: string]: any }))
          .filter(session => session.end_date && new Date(session.end_date) >= now);

      const activeSessionIds = activeAndValidSessions.map(s => s.id);

      if (activeSessionIds.length === 0) {
        return res.status(200).json({ scenarios: [], training_sessions: [], message: "Aucune session de formation active" });
      }
      
      const scenarioLinks = await db.collection('training_session_scenarios').where('training_session_id', 'in', activeSessionIds).get();
      const scenarioIds = [...new Set(scenarioLinks.docs.map(doc => doc.data().scenario_id))];

      if (scenarioIds.length === 0) {
        return res.status(200).json({ scenarios: [], training_sessions: activeAndValidSessions });
      }

      const scenarioPromises: Promise<QuerySnapshot<DocumentData>>[] = [];
      for (let i = 0; i < scenarioIds.length; i += 10) {
          const chunk = scenarioIds.slice(i, i + 10);
          scenarioPromises.push(db.collection('ecos_scenarios').where(FieldPath.documentId(), 'in', chunk).get());
      }

      const scenarioSnapshots = await Promise.all(scenarioPromises);
      const scenarios = scenarioSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      return res.status(200).json({ scenarios, training_sessions: activeAndValidSessions });

    } catch (error: any) {
       if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Error getting available scenarios:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération des scénarios" });
    }
  });

  return httpServer;
}