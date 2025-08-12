import type { IncomingMessage, ServerResponse } from 'http';
import { getPool, ensureConnected, mapRowToScenario } from '../lib/db';

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  try {
    await ensureConnected();
  } catch (e: any) {
    return json(res, 500, { message: 'Database connection failed', error: e.message });
  }

  const method = (req.method || 'GET').toUpperCase();
  const pool = getPool();

  if (method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end();
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, title, description FROM ecos_scenarios ORDER BY created_at DESC`
    );
    const scenarios = rows.map(mapRowToScenario);
    return json(res, 200, { scenarios });
  } catch (e: any) {
    return json(res, 500, { message: 'Failed to fetch scenarios', error: e.message });
  }
}
