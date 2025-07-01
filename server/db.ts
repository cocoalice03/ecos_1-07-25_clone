import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import * as schema from "@shared/schema";

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });

// Function to create training sessions tables
export async function createTrainingSessionsTables() {
  try {
    const sqlScript = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'create-training-sessions-tables.sql'),
      'utf8'
    );

    const client = await pool.connect();
    await client.query(sqlScript);
    client.release();

    console.log('✅ Training sessions tables created successfully');
  } catch (error) {
    console.error('❌ Error creating training sessions tables:', error);
    throw error;
  }
}