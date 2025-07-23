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
      const { SupabaseClientService } = await import('./services/supabase-client.service');
      const dbService = new SupabaseClientService();
      
      try {
        await dbService.connect();
        console.log('✅ Database connection successful!');
        const scenarios = await dbService.getScenarios();
        console.log(`✅ Found ${scenarios.length} scenarios in database`);
        // Scenarios are now available in the database
        
        console.log('📊 Attempting to sync scenarios from Pinecone...');
        await scenarioSyncService.syncScenariosFromPinecone();
        console.log('✅ Pinecone sync completed');
      } catch (error: any) {
        console.error('❌ Database connection test failed:', error.message);
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

  // Route to create a new scenario
  app.post("/api/ecos/scenarios", async (req: Request, res: Response) => {
    const { email, title, description, patientPrompt, evaluationCriteria, pineconeIndex } = req.body;
    
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    if (!title || !description) {
      return res.status(400).json({ message: "Titre et description requis" });
    }

    try {
      // Parse and validate evaluation criteria if provided
      let parsedCriteria = null;
      if (evaluationCriteria) {
        try {
          parsedCriteria = JSON.parse(evaluationCriteria);
        } catch (parseError) {
          return res.status(400).json({ 
            message: "Format JSON invalide pour les critères d'évaluation",
            error: parseError.message 
          });
        }
      }

      const { SupabaseClientService } = await import('./services/supabase-client.service');
      const dbService = new SupabaseClientService();
      await dbService.connect();

      const newScenario = await dbService.createScenario({
        title,
        description,
        patientPrompt: patientPrompt || null,
        evaluationCriteria: parsedCriteria,
        imageUrl: null,
        createdBy: email
      });

      res.status(200).json({ 
        message: "Scénario créé avec succès",
        scenario: newScenario
      });

    } catch (error: any) {
      console.error("Error creating scenario:", error);
      res.status(500).json({ 
        message: "Erreur lors de la création du scénario",
        error: error.message
      });
    }
  });

  // Route to update a scenario
  app.put("/api/ecos/scenarios/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, title, description, patientPrompt, evaluationCriteria, pineconeIndex } = req.body;
    
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      // Parse and validate evaluation criteria if provided
      let parsedCriteria = null;
      if (evaluationCriteria) {
        try {
          parsedCriteria = JSON.parse(evaluationCriteria);
        } catch (parseError) {
          return res.status(400).json({ 
            message: "Format JSON invalide pour les critères d'évaluation",
            error: parseError.message 
          });
        }
      }

      const { SupabaseClientService } = await import('./services/supabase-client.service');
      const dbService = new SupabaseClientService();
      await dbService.connect();

      const updatedScenario = await dbService.updateScenario(id, {
        title,
        description,
        patientPrompt: patientPrompt || null,
        evaluationCriteria: parsedCriteria,
        pineconeIndex: pineconeIndex || null
      });

      res.status(200).json({ 
        message: "Scénario modifié avec succès",
        scenario: updatedScenario
      });

    } catch (error: any) {
      console.error("Error updating scenario:", error);
      res.status(500).json({ 
        message: "Erreur lors de la modification du scénario",
        error: error.message
      });
    }
  });

  // Route to delete a scenario
  app.delete("/api/ecos/scenarios/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      const { SupabaseClientService } = await import('./services/supabase-client.service');
      const dbService = new SupabaseClientService();
      await dbService.connect();

      await dbService.deleteScenario(id);

      res.status(200).json({ 
        message: "Scénario supprimé avec succès"
      });

    } catch (error: any) {
      console.error("Error deleting scenario:", error);
      res.status(500).json({ 
        message: "Erreur lors de la suppression du scénario",
        error: error.message
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

  // Route to get available Pinecone indexes
  app.get("/api/admin/indexes", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      const { pineconeService } = await import('./services/pinecone.service');
      console.log('🔄 Fetching Pinecone indexes...');
      
      const indexes = await pineconeService.listIndexes();
      console.log('✅ Indexes fetched successfully:', indexes);
      
      res.status(200).json({ 
        indexes,
        message: "Index récupérés avec succès" 
      });
    } catch (error: any) {
      console.error("Error fetching indexes:", error);
      res.status(500).json({ 
        message: "Erreur lors de la récupération des index Pinecone",
        error: error.message 
      });
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

  // API route to start a simulation session (disabled for now - using fallback data)
  app.post("/api/session/start", async (req: Request, res: Response) => {
    return res.status(501).json({ 
      message: "Fonctionnalité temporairement désactivée",
      details: "Cette fonctionnalité sera réactivée une fois la base de données connectée"
    });
  });

  // API route to get scenarios for a student
  app.get("/api/student/scenarios", async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
    });

    try {
      const { email } = schema.parse(req.query);
      
      // Use scenario sync service to get scenarios
      try {
        const scenarios = await scenarioSyncService.getAvailableScenarios();
        
        res.status(200).json({ 
          scenarios: scenarios,
          training_sessions: [],
          source: 'database'
        });
      } catch (dbError: any) {
        console.error('Database error:', dbError);
        // Return empty array if database error
        res.status(200).json({ 
          scenarios: [],
          training_sessions: [],
          source: 'database',
          error: 'Database connection issue'
        });
      }

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Error in /api/student/scenarios:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // Admin health check 
  app.get("/api/admin/health", async (req: Request, res: Response) => {
    try {
      const { SupabaseClientService } = await import('./services/supabase-client.service');
      const dbService = new SupabaseClientService();
      
      try {
        await dbService.connect();
        res.status(200).json({ status: 'healthy', message: 'Database connection is working.' });
      } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
      }
    } catch (error: any) {
      console.error('Health check failed:', error);
      res.status(500).json({ status: 'error', message: 'Health check failed.', error: error.message });
    }
  });

  // Update a training session (disabled for now)
  app.put("/api/training-sessions/:id", async (req: Request, res: Response) => {
    return res.status(501).json({ 
      message: "Fonctionnalité temporairement désactivée",
      details: "Cette fonctionnalité sera réactivée une fois la base de données connectée"
    });
  });

  // Delete a training session (disabled for now)
  app.delete("/api/training-sessions/:id", async (req: Request, res: Response) => {
    return res.status(501).json({ 
      message: "Fonctionnalité temporairement désactivée",
      details: "Cette fonctionnalité sera réactivée une fois la base de données connectée"
    });
  });

  // Get available scenarios for a student (disabled for now)
  app.get("/api/student/available-scenarios", async (req: Request, res: Response) => {
    return res.status(501).json({ 
      message: "Fonctionnalité temporairement désactivée",
      details: "Cette fonctionnalité sera réactivée une fois la base de données connectée"
    });
  });

  return httpServer;
}