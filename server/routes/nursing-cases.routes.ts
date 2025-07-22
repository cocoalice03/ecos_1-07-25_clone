import { Request, Response, Router } from 'express';
import { nursingCasesService } from '../services/nursing-cases.service';
import { z } from 'zod';

export function createNursingCasesRoutes() {
  const router = Router();

  // Initialize nursing cases table and insert default case
  router.post('/api/nursing-cases/initialize', async (req: Request, res: Response) => {
    try {
      console.log('🔧 Initializing nursing cases...');
      
      // Initialize table
      const tableResult = await nursingCasesService.initializeNursingCasesTable();
      if (!tableResult.success) {
        return res.status(500).json({
          message: "Erreur lors de l'initialisation de la table",
          error: tableResult.error
        });
      }

      // Insert default nursing case
      const insertResult = await nursingCasesService.insertNursingCase();
      if (!insertResult.success) {
        return res.status(500).json({
          message: "Erreur lors de l'insertion du cas infirmier",
          error: insertResult.error
        });
      }

      res.status(200).json({
        message: "Cas infirmier créé et hébergé avec succès dans Supabase",
        data: insertResult.data
      });
    } catch (error: any) {
      console.error('Error initializing nursing cases:', error);
      res.status(500).json({
        message: "Erreur lors de l'initialisation",
        error: error.message
      });
    }
  });

  // Get all nursing cases
  router.get('/api/nursing-cases', async (req: Request, res: Response) => {
    try {
      const result = await nursingCasesService.getAllNursingCases();
      
      if (!result.success) {
        return res.status(500).json({
          message: "Erreur lors de la récupération des cas infirmiers",
          error: result.error,
          cases: []
        });
      }

      res.status(200).json({
        message: "Cas infirmiers récupérés avec succès",
        cases: result.data
      });
    } catch (error: any) {
      console.error('Error fetching nursing cases:', error);
      res.status(500).json({
        message: "Erreur lors de la récupération",
        error: error.message,
        cases: []
      });
    }
  });

  // Get a specific nursing case
  router.get('/api/nursing-cases/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await nursingCasesService.getNursingCaseById(id);
      
      if (!result.success) {
        return res.status(404).json({
          message: "Cas infirmier non trouvé",
          error: result.error
        });
      }

      res.status(200).json({
        message: "Cas infirmier récupéré avec succès",
        case: result.data
      });
    } catch (error: any) {
      console.error('Error fetching nursing case:', error);
      res.status(500).json({
        message: "Erreur lors de la récupération",
        error: error.message
      });
    }
  });

  // Create a new nursing case
  router.post('/api/nursing-cases', async (req: Request, res: Response) => {
    try {
      const caseSchema = z.object({
        id: z.string(),
        title: z.string(),
        category: z.string(),
        difficulty: z.string(),
        estimatedTime: z.number(),
        patientInfo: z.object({}).passthrough(),
        clinicalPresentation: z.object({}).passthrough(),
        nursingAssessment: z.object({}).passthrough(),
        nursingInterventions: z.array(z.object({}).passthrough()),
        expectedOutcomes: z.array(z.object({}).passthrough()),
        criticalThinkingQuestions: z.array(z.object({}).passthrough()),
        teachingPoints: z.array(z.string()),
        additionalResources: z.array(z.string())
      });

      const caseData = caseSchema.parse(req.body);
      
      const result = await nursingCasesService.insertNursingCase(caseData);
      
      if (!result.success) {
        return res.status(500).json({
          message: "Erreur lors de la création du cas infirmier",
          error: result.error
        });
      }

      res.status(201).json({
        message: "Cas infirmier créé avec succès",
        data: result.data
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Données invalides",
          errors: error.errors
        });
      }
      
      console.error('Error creating nursing case:', error);
      res.status(500).json({
        message: "Erreur lors de la création",
        error: error.message
      });
    }
  });

  return router;
}