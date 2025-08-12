import type { IncomingMessage, ServerResponse } from 'http';
import { getPool, ensureConnected, mapAggregatedRowToSession } from '../lib/db';

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req
      .on('data', (c) => chunks.push(c))
      .on('end', () => {
        if (chunks.length === 0) return resolve({});
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve({});
        }
      })
      .on('error', reject);
  });
}

export default async function handler(req: IncomingMessage & { method?: string; url?: string }, res: ServerResponse) {
  try {
    await ensureConnected();
  } catch (e: any) {
    return json(res, 500, { message: 'Database connection failed', error: e.message });
  }

  const method = (req.method || 'GET').toUpperCase();
  const pool = getPool();

  if (method === 'GET') {
    try {
      const { rows } = await pool.query(
        `SELECT 
           ts.id,
           ts.title,
           ts.description,
           ts.start_date,
           ts.end_date,
           COALESCE(
             json_agg(DISTINCT jsonb_build_object('id', es.id, 'title', es.title, 'description', es.description))
             FILTER (WHERE es.id IS NOT NULL), '[]'::json
           ) AS scenarios,
           (
             SELECT COUNT(*)::int FROM training_session_students tss 
             WHERE tss.training_session_id = ts.id
           ) AS student_count
         FROM training_sessions ts
         LEFT JOIN training_session_scenarios tsc ON tsc.training_session_id = ts.id
         LEFT JOIN ecos_scenarios es ON es.id = tsc.scenario_id
         GROUP BY ts.id
         ORDER BY ts.created_at DESC`
      );
      const trainingSessions = rows.map(mapAggregatedRowToSession);
      return json(res, 200, { trainingSessions });
    } catch (e: any) {
      return json(res, 500, { message: 'Failed to fetch sessions', error: e.message });
    }
  }

  if (method === 'POST') {
    try {
      const body = await parseBody(req);
      const {
        title,
        description,
        startDate,
        endDate,
        scenarioIds = [],
        studentEmails = [],
        email: createdBy,
      } = body || {};

      if (!title || !startDate || !endDate) {
        return json(res, 400, { message: 'Missing required fields: title, startDate, endDate' });
      }

      // Create session
      const insert = await pool.query(
        `INSERT INTO training_sessions (title, description, start_date, end_date, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id` ,
        [title, description || null, new Date(startDate), new Date(endDate), createdBy || null]
      );
      const sessionId = insert.rows[0].id as number;

      // Attach scenarios
      const scenIds = Array.isArray(scenarioIds) ? scenarioIds.map((v: any) => Number(v)).filter((n: any) => Number.isInteger(n)) : [];
      if (scenIds.length > 0) {
        const values = scenIds.map((_, i) => `($1, $${i + 2})`).join(',');
        await pool.query(
          `INSERT INTO training_session_scenarios (training_session_id, scenario_id) VALUES ${values}`,
          [sessionId, ...scenIds]
        );
      }

      // Attach students
      const emails = Array.isArray(studentEmails) ? studentEmails.map(String).filter((s) => s.length > 0) : [];
      if (emails.length > 0) {
        const values = emails.map((_, i) => `($1, $${i + 2})`).join(',');
        await pool.query(
          `INSERT INTO training_session_students (training_session_id, student_email) VALUES ${values}`,
          [sessionId, ...emails]
        );
      }

      // Return aggregated row
      const { rows } = await pool.query(
        `SELECT 
           ts.id,
           ts.title,
           ts.description,
           ts.start_date,
           ts.end_date,
           COALESCE(
             json_agg(DISTINCT jsonb_build_object('id', es.id, 'title', es.title, 'description', es.description))
             FILTER (WHERE es.id IS NOT NULL), '[]'::json
           ) AS scenarios,
           (
             SELECT COUNT(*)::int FROM training_session_students tss 
             WHERE tss.training_session_id = ts.id
           ) AS student_count
         FROM training_sessions ts
         LEFT JOIN training_session_scenarios tsc ON tsc.training_session_id = ts.id
         LEFT JOIN ecos_scenarios es ON es.id = tsc.scenario_id
         WHERE ts.id = $1
         GROUP BY ts.id`,
        [sessionId]
      );
      const session = mapAggregatedRowToSession(rows[0]);
      return json(res, 201, { trainingSession: session });
    } catch (e: any) {
      return json(res, 500, { message: 'Failed to create session', error: e.message });
    }
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end();
}
