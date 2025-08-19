import type { IncomingMessage, ServerResponse } from 'http';

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0);
  try {
    const connectionString = process.env.DATABASE_URL as string;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    const pgMod = await import('pg');
    const { Pool } = (pgMod as any).default ?? pgMod;
    const pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 1,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
      await pool.end();
    }
    return json(res, 200, { ok: true, hasDatabaseUrl });
  } catch (e: any) {
    const err = { name: e?.name, code: e?.code, message: e?.message || 'unknown' };
    try { console.error('[api/db-health] error:', err); } catch {}
    return json(res, 500, { ok: false, hasDatabaseUrl, ...err });
  }
}
