
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  users, 
  sessions, 
  exchanges, 
  dailyCounters, 
  ecosScenarios, 
  ecosSessions, 
  ecosMessages, 
  ecosEvaluations,
  trainingSessions,
  trainingSessionStudents,
  trainingSessionScenarios
} from '../shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres client with connection retry
const client = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  connect_timeout: 10,
  idle_timeout: 20,
  prepare: false,
});

// Create drizzle instance
export const db = drizzle(client, {
  schema: {
    users,
    sessions,
    exchanges,
    dailyCounters,
    ecosScenarios,
    ecosSessions,
    ecosMessages,
    ecosEvaluations,
    trainingSessions,
    trainingSessionStudents,
    trainingSessionScenarios
  }
});

console.log('✅ Connected to Supabase PostgreSQL database');

// Export schema for use in other files
export {
  users,
  sessions,
  exchanges,
  dailyCounters,
  ecosScenarios,
  ecosSessions,
  ecosMessages,
  ecosEvaluations,
  trainingSessions,
  trainingSessionStudents,
  trainingSessionScenarios
};
