// Firebase removed - using native Date/string types

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
  createdAt?: Date;
  updatedAt?: Date;
}

export type UpsertUser = Omit<User, 'id'>;

export interface Exchange {
  id: string;
  email: string;
  question: string;
  response: string;
  timestamp: Date;
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
  createdAt?: Date;
}

export interface EcosSession {
  id: string;
  scenarioId: string;
  studentEmail: string;
  trainingSessionId?: string;
  startTime?: Date;
  endTime?: Date;
  status: 'in_progress' | 'completed' | 'failed';
}

export interface EcosMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface TrainingSession {
    id: string;
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    createdBy: string;
    createdAt?: Date;
}

export interface TrainingSessionStudent {
    id: string;
    trainingSessionId: string;
    studentEmail: string;
    assignedAt?: Date;
}

export interface TrainingSessionScenario {
    id: string;
    trainingSessionId: string;
    scenarioId: string;
}



export interface DailyCounter {
  id: string;
  email: string;
  date: Date;
  count: number;
}

export type InsertCounter = Omit<DailyCounter, 'id'>;

export interface EcosEvaluation {
  id: string;
  sessionId: string;
  criterionId: string;
  score: number;
  feedback?: string;
  createdAt?: Date;
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
  timestamp?: Date;
}
