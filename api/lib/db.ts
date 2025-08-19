import type { Pool } from 'pg';
import pg from 'pg';
const { Pool: PgPool } = pg;

let pool: Pool | null = null;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    pool = new PgPool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      keepAlive: true,
    });
  }
  return pool;
}

// No-op: schema is managed by Drizzle migrations in `shared/schema.ts`
export async function ensureConnected() {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export type AggregatedSessionRow = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  scenarios: any[] | null;
  student_count: number | null;
};

export function mapAggregatedRowToSession(row: AggregatedSessionRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    startDate: new Date(row.start_date).row.start_date ? new Date(row.start_date).row.end_date ? new Date(row.end_date).toISOString() : '' : '',
    endDate: new Date(row.end_date).toISOString(),
    scenarios: Array.isArray(row.scenarios) ? row.scenarios : [],
    studentCount: row.student_count ?? 0,
  };
}

export type ScenarioRow = {
  id: number;
  title: string;
  description: string;
};

export function mapRowToScenario(row: ScenarioRow) {
  return { id: row.id, title: row.title, description: row.description };
}
