// Service Firestore supprimé
// Remplacez par des appels API REST vers PostgreSQL

export interface DashboardData {
  scenarios?: any[];
  sessions?: any[];
  stats?: {
    totalScenarios?: number;
    totalSessions?: number;
    totalUsers?: number;
    completionRate?: number;
    activeSessions?: number;
    completedSessions?: number;
    totalStudents?: number;
    partial?: boolean;
  };
}

export class FirestoreService {
  static async getDashboardData(email: string): Promise<DashboardData> {
    try {
      // Remplacez par un appel API REST
      const response = await fetch(`/api/dashboard?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la récupération des données du dashboard:', error);
      throw error;
    }
  }

  static async getScenarios(email: string): Promise<any[]> {
    try {
      // Remplacez par un appel API REST
      const response = await fetch(`/api/scenarios?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des scénarios');
      }
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la récupération des scénarios:', error);
      throw error;
    }
  }
}

export default FirestoreService;