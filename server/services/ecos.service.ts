import { evaluationService } from './evaluation.service.js';
import { pineconeService } from './pinecone.service.js';
// Firebase supprimé - utilisez PostgreSQL
// import { Pool } from 'pg';

export class EcosService {
  static async getScenarios(): Promise<any[]> {
    // Retourner des données mockées temporairement
    return [
      { id: '1', title: 'ECOS Scénario 1', type: 'clinical', status: 'active', createdAt: new Date().toISOString(), exchanges: 5 },
      { id: '2', title: 'ECOS Scénario 2', type: 'emergency', status: 'active', createdAt: new Date().toISOString(), exchanges: 8 }
    ];
  }

  static async createSession(scenarioId: string, studentEmail: string): Promise<any> {
    // Mock temporaire
    return {
      id: `session_${Date.now()}`,
      scenarioId,
      studentEmail,
      status: 'active',
      startTime: new Date().toISOString()
    };
  }

  static async getSessions(studentEmail: string): Promise<any[]> {
    // Mock temporaire
    return [];
  }
}

export const ecosService = new EcosService();