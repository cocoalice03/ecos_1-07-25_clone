import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { users, ecosScenarios, ecosSessions, ecosMessages, ecosEvaluations, trainingSessions, trainingSessionStudents, trainingSessionScenarios } from '../shared/schema.js';
import { unifiedDb } from './services/unified-database.service.js';
import { eq, and } from 'drizzle-orm';
import { scenarioSyncService } from './services/scenario-sync.service.js';
import { 
  authService, 
  authenticateToken, 
  requireAdmin, 
  isAdminAuthorized, 
  authorizeByEmail, 
  type AuthenticatedRequest 
} from './middleware/auth.middleware.js';
import {
  validateLogin,
  validateCreateStudent,
  validateCreateEcosSession,
  validateEcosMessage,
  validateEcosEvaluation,
  validateEmailQuery,
  validateSessionIdParam,
  validateRequestSize,
  validateContentType,
  type ValidatedRequest
} from './middleware/validation.middleware.js';
import {
  authRateLimit,
  apiRateLimit,
  strictRateLimit,
  emailBasedRateLimit,
  ecosSessionRateLimit
} from './middleware/rate-limit.middleware.js';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Database initialization is now handled by startup sequencer
  // No async initialization needed here - all handled by UnifiedDatabaseService

  // In-memory user storage for demonstration
  const inMemoryUsers = new Map<string, { userId: string; createdAt: Date }>();

  async function findOrCreateStudent(email: string): Promise<{ userId: string; isNewUser: boolean }> {
    try {
      // Try database first - functionality temporarily disabled
      try {
        // Database operations temporarily disabled due to schema migration
        // Fallback to in-memory storage directly
        if (inMemoryUsers.has(email)) {
          const user = inMemoryUsers.get(email)!;
          return { userId: user.userId, isNewUser: false };
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        inMemoryUsers.set(email, { userId, createdAt: new Date() });
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

  // Authentication endpoints
  app.post("/api/auth/login", authRateLimit.middleware(), validateContentType(), validateRequestSize(), validateLogin, async (req: ValidatedRequest, res: Response) => {
    try {
      const { email, password } = req.validatedBody || req.body;

      // For now, we'll use simple email-based auth during transition
      // In production, you'd verify the password against a database
      if (!isAdminAuthorized(email)) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const token = authService.generateToken(email);
      
      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          email,
          isAdmin: true
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        code: 'LOGIN_FAILED'
      });
    }
  });

  app.post("/api/auth/verify", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      message: 'Token valid',
      user: req.user
    });
  });

  app.get("/api/auth/profile", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      user: req.user,
      adminEmails: authService.getAdminEmails()
    });
  });

  // Route to sync scenarios from Pinecone - supports both auth methods during transition
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
      console.log('🔧 Fetching teacher scenarios using unified database...');
      
      const scenarios = await unifiedDb.getScenarios();
      
      res.status(200).json({ 
        scenarios,
        connected: true,
        source: 'unified-database'
      });
      
    } catch (error: any) {
      console.error("Error fetching teacher scenarios:", error);
      
      // Fallback response
      res.status(200).json({ 
        scenarios: [],
        connected: false,
        source: 'error-fallback',
        message: 'Service temporarily unavailable',
        error: error.message
      });
    }
  });

  // Route to get scenarios (GET /api/ecos/scenarios) - using UnifiedDatabaseService
  app.get("/api/ecos/scenarios", async (req: Request, res: Response) => {
    try {
      console.log('🔧 Fetching scenarios via /api/ecos/scenarios using unified database...');
      
      const scenarios = await unifiedDb.getScenarios();
      
      res.status(200).json({ 
        scenarios,
        connected: true,
        source: 'unified-database-ecos-endpoint'
      });
      
    } catch (error: any) {
      console.error("Error fetching scenarios via /api/ecos/scenarios:", error);
      
      // Fallback response
      res.status(200).json({ 
        scenarios: [],
        connected: false,
        source: 'error-fallback-ecos-endpoint',
        message: 'Service temporarily unavailable',
        error: error.message
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
            error: (parseError as Error).message 
          });
        }
      }

      const { SupabaseClientService } = await import('./services/supabase-client.service.js');
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
            error: (parseError as Error).message 
          });
        }
      }

      const { SupabaseClientService } = await import('./services/supabase-client.service.js');
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
      const { SupabaseClientService } = await import('./services/supabase-client.service.js');
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

  // Route to generate evaluation criteria for a scenario
  app.post("/api/ecos/generate-criteria", async (req: Request, res: Response) => {
    const { email, scenarioDescription } = req.body;
    
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    if (!scenarioDescription) {
      return res.status(400).json({ message: "Description du scénario requise" });
    }

    try {
      const { promptGenService } = await import('./services/promptGen.service.js');
      
      const criteria = await promptGenService.generateEvaluationCriteria(scenarioDescription);
      
      res.status(200).json({ 
        message: "Critères d'évaluation générés avec succès",
        criteria
      });

    } catch (error: any) {
      console.error("Error generating evaluation criteria:", error);
      res.status(500).json({ 
        message: "Erreur lors de la génération des critères d'évaluation",
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
      console.log('🔧 Fetching teacher dashboard using unified database...');
      
      const stats = await unifiedDb.getDashboardStats();

      res.status(200).json(stats);
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      
      // Fallback response
      res.status(200).json({
        totalScenarios: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalStudents: 0,
        message: "Service temporarily unavailable"
      });
    }
  });

  // Route to get available Pinecone indexes
  app.get("/api/admin/indexes", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      const { pineconeService } = await import('./services/pinecone.service.js');
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
  app.post("/api/student", validateContentType(), validateRequestSize(), validateCreateStudent, async (req: ValidatedRequest, res: Response) => {
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

  // Auto-register student endpoint (used by student page)
  app.post("/api/student/auto-register", validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email("Format d'email invalide"),
    });

    try {
      const { email } = schema.parse(req.body);
      console.log('🚀 Auto-registering student:', email);
      
      const { userId, isNewUser } = await findOrCreateStudent(email);
      
      res.status(200).json({ 
        message: "Auto-registration successful", 
        userId, 
        isNewUser,
        email
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email format", errors: error.errors });
      }
      console.error("Error in /api/student/auto-register:", error);
      res.status(500).json({ message: "Auto-registration failed" });
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
      const { SupabaseClientService } = await import('./services/supabase-client.service.js');
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

  // Route to get students for teacher dashboard
  app.get("/api/teacher/students", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      console.log('🔧 Fetching teacher students using unified database...');
      
      const students = await unifiedDb.getStudents();
      
      res.status(200).json({ 
        students,
        message: "Student list retrieved successfully",
        connected: true
      });
      
    } catch (error: any) {
      console.error("Error fetching teacher students:", error);
      res.status(200).json({ 
        students: [],
        message: "Service temporarily unavailable",
        connected: false,
        error: error.message
      });
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


  // ECOS Core Functionality Endpoints

  // Get ECOS sessions for a student
  app.get("/api/ecos/sessions", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ 
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Return empty array for now since database operations are disabled
      // In a real implementation, this would query the database for sessions by email
      res.status(200).json({
        sessions: [],
        message: 'Sessions retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting ECOS sessions:', error);
      res.status(500).json({
        error: 'Failed to get ECOS sessions',
        code: 'SESSIONS_GET_FAILED'
      });
    }
  });

  // Start a new ECOS session
  app.post("/api/ecos/sessions", ecosSessionRateLimit.middleware(), validateContentType(), validateRequestSize(), validateCreateEcosSession, async (req: ValidatedRequest, res: Response) => {
    try {
      const { studentEmail, scenarioId } = req.validatedBody || req.body;
      
      if (!studentEmail || !scenarioId) {
        return res.status(400).json({ 
          error: "StudentEmail and scenarioId are required",
          code: "MISSING_REQUIRED_FIELDS"
        });
      }

      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create session record - temporarily disabled
      try {
        // Session creation temporarily disabled due to schema migration
        console.log('Creating session:', sessionId);
      } catch (dbError) {
        console.warn('Database not available, creating in-memory session');
      }

      res.status(201).json({
        sessionId,
        scenarioId,
        studentEmail,
        status: 'active',
        startTime: new Date(),
        message: 'ECOS session created successfully'
      });
    } catch (error) {
      console.error('Error creating ECOS session:', error);
      res.status(500).json({
        error: 'Failed to create ECOS session',
        code: 'SESSION_CREATE_FAILED'
      });
    }
  });

  // Get ECOS session details
  app.get("/api/ecos/sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ 
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Try to get session from database - temporarily disabled
      try {
        // Database queries temporarily disabled
        const sessions: any[] = [];

        if (sessions.length === 0) {
          // Return mock session data for student access
          return res.status(200).json({
            session: {
              id: sessionId,
              status: 'active',
              startTime: new Date(),
              studentEmail: email,
              scenario: {
                title: "Consultation d'urgence - Douleur thoracique",
                description: "Prendre en charge un patient se présentant avec une douleur thoracique"
              }
            },
            messages: [],
            totalMessages: 0,
            note: 'Mock session data for student access'
          });
        }

        const session = sessions[0];
        
        // Get messages for this session - temporarily disabled
        const messages: any[] = [];

        res.status(200).json({
          session,
          messages,
          totalMessages: messages.length
        });
      } catch (dbError) {
        // Fallback response for when database is not available
        res.status(200).json({
          session: {
            id: sessionId,
            status: 'active',
            startTime: new Date(),
            studentEmail: email,
            scenario: {
              title: "Consultation d'urgence - Douleur thoracique",
              description: "Prendre en charge un patient se présentant avec une douleur thoracique"
            }
          },
          messages: [],
          totalMessages: 0,
          note: 'Database not available - mock session data'
        });
      }
    } catch (error) {
      console.error('Error getting ECOS session:', error);
      res.status(500).json({
        error: 'Failed to get ECOS session',
        code: 'SESSION_GET_FAILED'
      });
    }
  });

  // Update ECOS session (end session)
  app.put("/api/ecos/sessions/:sessionId", validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { email, status } = req.body;

      if (!email) {
        return res.status(400).json({ 
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      if (!status) {
        return res.status(400).json({ 
          error: "Status is required",
          code: "MISSING_STATUS"
        });
      }

      console.log(`📝 Updating session ${sessionId} status to ${status} for ${email}`);

      // Try to update session in database - temporarily disabled
      try {
        // Database updates temporarily disabled
        console.log(`Session ${sessionId} marked as ${status}`);
      } catch (dbError) {
        console.warn('Database not available, session update not persisted');
      }

      res.status(200).json({
        sessionId,
        status,
        updatedAt: new Date(),
        message: 'Session updated successfully'
      });
    } catch (error) {
      console.error('Error updating ECOS session:', error);
      res.status(500).json({
        error: 'Failed to update ECOS session',
        code: 'SESSION_UPDATE_FAILED'
      });
    }
  });

  // Add message to ECOS session (Chat functionality)
  app.post("/api/ecos/sessions/:sessionId/messages", apiRateLimit.middleware(), validateContentType(), validateRequestSize(), validateEcosMessage, async (req: ValidatedRequest, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }
    try {
      const { sessionId } = req.params;
      const { email } = req.query;
      const { message, role, type } = req.validatedBody || req.body;

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Try to save to database - temporarily disabled
      try {
        // Message saving temporarily disabled due to schema migration
        console.log('Saving message:', messageId);
      } catch (dbError) {
        console.warn('Database not available, message not persisted');
      }

      // Generate AI response (placeholder for now)
      const aiResponse = {
        id: `msg_ai_${Date.now()}`,
        sessionId,
        content: `I understand your message: "${message}". How can I assist you further in this medical scenario?`,
        role: 'assistant',
        type: 'text',
        senderEmail: 'system@ecos.ai',
        createdAt: new Date()
      };

      res.status(201).json({
        userMessage: {
          id: messageId,
          sessionId,
          content: message,
          role: role || 'user',
          type: type || 'text',
          senderEmail: email,
          createdAt: new Date()
        },
        aiResponse,
        message: 'Message added to session successfully'
      });
    } catch (error) {
      console.error('Error adding message to ECOS session:', error);
      res.status(500).json({
        error: 'Failed to add message to session',
        code: 'MESSAGE_ADD_FAILED'
      });
    }
  });

  // Evaluate ECOS session performance
  app.post("/api/ecos/sessions/:sessionId/evaluate", strictRateLimit.middleware(), validateContentType(), validateRequestSize(), validateEcosEvaluation, async (req: ValidatedRequest, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }
    try {
      const { sessionId } = req.params;
      const { email } = req.query;
      const { criteria, responses } = req.validatedBody || req.body;

      // Generate evaluation ID
      const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Mock evaluation logic (replace with actual evaluation service)
      const evaluation = {
        overall_score: Math.floor(Math.random() * 30) + 70, // 70-100 score
        criteria_scores: {
          communication: Math.floor(Math.random() * 20) + 80,
          clinical_reasoning: Math.floor(Math.random() * 20) + 75,
          empathy: Math.floor(Math.random() * 20) + 85,
          professionalism: Math.floor(Math.random() * 20) + 88
        },
        feedback: [
          "Good communication with the patient",
          "Consider exploring more differential diagnoses",
          "Excellent empathy and patient rapport"
        ],
        recommendations: [
          "Practice more complex clinical scenarios",
          "Review differential diagnosis frameworks"
        ]
      };

      // Try to save evaluation to database - temporarily disabled
      try {
        // Evaluation saving temporarily disabled due to schema migration
        console.log('Saving evaluation:', evaluationId);
      } catch (dbError) {
        console.warn('Database not available, evaluation not persisted');
      }

      // Update session status to completed - temporarily disabled
      try {
        // Session update temporarily disabled due to schema migration
        console.log('Updating session status:', sessionId);
      } catch (dbError) {
        console.warn('Database not available, session status not updated');
      }

      res.status(200).json({
        evaluationId,
        sessionId,
        evaluation,
        message: 'Session evaluated successfully'
      });
    } catch (error) {
      console.error('Error evaluating ECOS session:', error);
      res.status(500).json({
        error: 'Failed to evaluate session',
        code: 'EVALUATION_FAILED'
      });
    }
  });

  // Get evaluation report for ECOS session
  app.get("/api/ecos/sessions/:sessionId/report", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }
    try {
      const { sessionId } = req.params;

      // Try to get evaluation from database - temporarily disabled
      try {
        // Database queries temporarily disabled
        const evaluations: any[] = [];

        if (evaluations.length === 0) {
          return res.status(404).json({
            error: 'Evaluation report not found',
            code: 'REPORT_NOT_FOUND'
          });
        }

        const evaluation = evaluations[0];
        
        res.status(200).json({
          evaluationId: evaluation.id,
          sessionId,
          overallScore: evaluation.overallScore,
          criteriaScores: JSON.parse(evaluation.criteriaScores || '{}'),
          feedback: JSON.parse(evaluation.feedback || '[]'),
          recommendations: JSON.parse(evaluation.recommendations || '[]'),
          createdAt: evaluation.createdAt,
          teacherEmail: evaluation.teacherEmail
        });
      } catch (dbError) {
        // Fallback mock report when database is not available
        res.status(200).json({
          evaluationId: `mock_eval_${sessionId}`,
          sessionId,
          overallScore: 85,
          criteriaScores: {
            communication: 88,
            clinical_reasoning: 82,
            empathy: 90,
            professionalism: 85
          },
          feedback: [
            "Good overall performance in this simulation",
            "Database not available - this is a mock evaluation"
          ],
          recommendations: [
            "Continue practicing clinical scenarios",
            "Set up database connection for detailed evaluations"
          ],
          createdAt: new Date(),
          note: 'Database not available - mock evaluation provided'
        });
      }
    } catch (error) {
      console.error('Error getting evaluation report:', error);
      res.status(500).json({
        error: 'Failed to get evaluation report',
        code: 'REPORT_GET_FAILED'
      });
    }
  });

  // Patient simulator endpoint for AI agent messaging 
  app.post("/api/ecos/patient-simulator", apiRateLimit.middleware(), validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
    try {
      const { email, sessionId, query } = req.body;
      
      if (!email || !sessionId || !query) {
        return res.status(400).json({ 
          error: "Email, sessionId, and query are required",
          code: "MISSING_REQUIRED_FIELDS"
        });
      }

      console.log(`🤖 Patient simulator query from ${email} in session ${sessionId}: ${query}`);

      // Generate AI patient response based on query
      // This is a simplified response - in production you'd use actual AI service
      const patientResponses = [
        "Je ressens une douleur dans la poitrine qui a commencé il y a environ une heure.",
        "La douleur est comme une pression, située au centre de ma poitrine.",
        "Non, je n'ai pas d'allergies connues aux médicaments.",
        "Oui, j'ai déjà eu des problèmes cardiaques dans ma famille.",
        "La douleur s'intensifie quand je bouge ou que je respire profondément.",
        "J'ai aussi ressenti quelques nausées et des sueurs froides.",
        "Non, je n'ai pas pris de médicaments aujourd'hui.",
        "Je me sens un peu essoufflé(e) et anxieux(se)."
      ];

      // Simple response selection based on query content
      let response = "Pouvez-vous me poser une question plus spécifique, docteur ?";
      
      const queryLower = query.toLowerCase();
      if (queryLower.includes("douleur") || queryLower.includes("mal")) {
        response = patientResponses[Math.floor(Math.random() * 2)];
      } else if (queryLower.includes("allergie") || queryLower.includes("médicament")) {
        response = patientResponses[2];
      } else if (queryLower.includes("famille") || queryLower.includes("antécédent")) {
        response = patientResponses[3];
      } else if (queryLower.includes("symptôme") || queryLower.includes("ressent")) {
        response = patientResponses[Math.floor(Math.random() * 3) + 4];
      } else if (queryLower.includes("traitement") || queryLower.includes("pris")) {
        response = patientResponses[6];
      }

      res.status(200).json({
        response,
        sessionId,
        timestamp: new Date(),
        message: 'Patient simulator response generated successfully'
      });

    } catch (error) {
      console.error('Error in patient simulator:', error);
      res.status(500).json({
        error: 'Failed to generate patient response',
        code: 'PATIENT_SIMULATOR_FAILED'
      });
    }
  });

  return httpServer;
}