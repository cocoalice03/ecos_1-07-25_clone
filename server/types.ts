import { firestore } from 'firebase-admin';

export interface RAGContent {
  content: string;
  metadata?: {
    source?: string;
    [key: string]: any;
  };
}

export interface RAGContent {
  content: string;
  metadata?: {
    source?: string;
    [key: string]: any;
  };
}

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt?: firestore.Timestamp;
  updatedAt?: firestore.Timestamp;
}

export type UpsertUser = Omit<User, 'id'>;

export interface Exchange {
  id: string;
  email: string;
  question: string;
  response: string;
  timestamp: firestore.Timestamp;
}

export type InsertExchange = Omit<Exchange, 'id'>;

export interface EcosScenario {
  id: string;
  title: string;
  description: string;
  patientPrompt: string;
  evaluationCriteria: any; // JSONB can be represented as any or a more specific type
  pineconeIndex?: string;
  imageUrl?: string;
  createdBy: string;
  createdAt?: firestore.Timestamp;
}

export interface EcosSession {
  id: string;
  scenarioId: string;
  studentEmail: string;
  trainingSessionId?: string;
  startTime?: firestore.Timestamp;
  endTime?: firestore.Timestamp;
  status: 'in_progress' | 'completed' | 'failed';
}

export interface EcosMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: firestore.Timestamp;
}

export interface TrainingSession {
    id: string;
    title: string;
    description?: string;
    startDate: firestore.Timestamp;
    endDate: firestore.Timestamp;
    createdBy: string;
    createdAt?: firestore.Timestamp;
}

export interface TrainingSessionStudent {
    id: string;
    trainingSessionId: string;
    studentEmail: string;
    assignedAt?: firestore.Timestamp;
}

export interface TrainingSessionScenario {
    id: string;
    trainingSessionId: string;
    scenarioId: string;
}



export interface DailyCounter {
  id: string;
  email: string;
  date: firestore.Timestamp;
  count: number;
}

export type InsertCounter = Omit<DailyCounter, 'id'>;

export interface EcosEvaluation {
  id: string;
  sessionId: string;
  criterionId: string;
  score: number;
  feedback?: string;
  createdAt?: firestore.Timestamp;
}

export interface EcosReport {
  id: string;
  sessionId: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  isInsufficientContent?: boolean;
  message?: string;
  details?: string;
  scores?: any; // JSON object for scores
  globalScore?: number;
  feedback?: string;
  timestamp?: firestore.Timestamp;
}
