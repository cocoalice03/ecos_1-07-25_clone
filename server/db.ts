
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

console.log('✅ Connected to Supabase PostgreSQL database');

// Create postgres client with extended timeout for Supabase
const client = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  connect_timeout: 60,
  idle_timeout: 60,
  prepare: false,
  transform: postgres.camel,
  onnotice: () => {}, // Suppress notices
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
