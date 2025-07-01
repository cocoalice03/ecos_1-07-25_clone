import { apiRequest } from "./queryClient";

export interface UserStatus {
  email: string;
  questionsUsed: number;
  questionsRemaining: number;
  maxDailyQuestions: number;
  limitReached: boolean;
}

export interface AskResponse {
  id: number;
  question: string;
  response: string;
  timestamp: string;
  questionsUsed: number;
  questionsRemaining: number;
  limitReached: boolean;
}

export interface ChatExchange {
  id: number;
  email: string;
  question: string;
  response: string;
  timestamp: string;
}

export interface ChatHistory {
  exchanges: ChatExchange[];
}

// API functions
export const api = {
  // Get user status (questions remaining)
  async getUserStatus(email: string): Promise<UserStatus> {
    const res = await apiRequest(
      "GET", 
      `/api/status?email=${encodeURIComponent(email)}`
    );
    return await res.json();
  },

  // Get all students assigned to training sessions (for teacher view)
  async getTeacherStudents(email: string): Promise<any> {
    const res = await apiRequest(
      "GET", 
      `/api/teacher/students?email=${encodeURIComponent(email)}`
    );
    return await res.json();
  },

  // Ask a question
  async askQuestion(email: string, question: string): Promise<AskResponse> {
    const res = await apiRequest(
      "POST", 
      "/api/ask", 
      { email, question }
    );
    return await res.json();
  },

  // Get chat history
  async getChatHistory(email: string): Promise<ChatHistory> {
    const res = await apiRequest(
      "GET", 
      `/api/history?email=${encodeURIComponent(email)}`
    );
    return await res.json();
  }
};

import { useQuery } from '@tanstack/react-query';

export const teacherApi = {
  getDashboard: async (email: string) => {
    const response = await fetch(`/api/teacher/dashboard?email=${encodeURIComponent(email)}`);
    if (!response.ok) {
      throw new Error('Échec de récupération des données du dashboard');
    }
    const data = await response.json();
    console.log('API response data:', data);
    return data;
  },

  getIndexes: async (email: string) => {
    console.log('API: Fetching indexes for email:', email);
    const url = `/api/admin/indexes?email=${encodeURIComponent(email)}`;
    console.log('API: Request URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('API: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API: Error response:', errorText);
      throw new Error(`Failed to fetch indexes: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('API: Indexes response data:', data);
    return data;
  },
};

import { FirestoreService } from './firestore.service';

// Version mise à jour pour utiliser Firestore
export const useDashboardData = (email: string) => {
  return useQuery({
    queryKey: ['dashboard-data', email],
    queryFn: async () => {
      console.log('🔄 Fetching dashboard data for:', email);

      try {
        // Utiliser FirestoreService au lieu de l'API backend
        const response = await FirestoreService.getDashboardData(email);
        console.log('📊 Dashboard data loaded:', response);
        return response;
      } catch (error) {
        console.error('❌ Dashboard data error:', error);
        throw error;
      }
    },
    enabled: !!email,
    retry: 1
  });
};

export const useAvailableIndexes = (email: string) => {
  return useQuery({
    queryKey: ['available-indexes', email],
    queryFn: async () => {
      const response = await fetch(`/api/admin/indexes?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch indexes');
      }

      const data = await response.json();
      return data.indexes || [];
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useTeacherStudents = (email: string) => {
  return useQuery({
    queryKey: ['teacher-students', email],
    queryFn: async () => {
      const data = await api.getTeacherStudents(email);
      return data.students || [];
    },
    enabled: !!email,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};