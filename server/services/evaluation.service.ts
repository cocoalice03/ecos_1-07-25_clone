import { openaiService } from './openai.service.js';

// Firebase supprimé - utilisez PostgreSQL
// import { Pool } from 'pg';

export class EvaluationService {
  static async getEcosScenarios(): Promise<any[]> {
    throw new Error('Firebase supprimé - implémentez avec PostgreSQL');
  }

  static async createEcosSession(scenarioId: string, studentEmail: string): Promise<any> {
    throw new Error('Firebase supprimé - implémentez avec PostgreSQL');
  }

  static async updateSessionProgress(sessionId: string, progressData: any): Promise<void> {
    throw new Error('Firebase supprimé - implémentez avec PostgreSQL');
  }

  static async getSessionHistory(studentEmail: string): Promise<any[]> {
    throw new Error('Firebase supprimé - implémentez avec PostgreSQL');
  }
}

export const evaluationService = new EvaluationService();