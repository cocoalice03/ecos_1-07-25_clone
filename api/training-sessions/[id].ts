import type { IncomingMessage, ServerResponse } from 'http';
import { getPool, ensureConnected, mapAggregatedRowToSession } from '../lib/db';
import { URL } from 'url';

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

function getIdFromUrl(reqUrl?: string): number | null {
  if (!reqUrl) return null;
  try {
    // Construct dummy base to use URL
    const u = new URL(reqUrl, 'http://localhost');
    const parts = u.pathname.split('/').filter(Boolean);
    const idStr = parts[parts.length - 1];
    const id = Number(idStr);
    if (Number.isInteger(id)) return id;
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: IncomingMessage & { method?: string; url?: string }, res: ServerResponse) {
  try {
    await ensureConnected();
  } catch (e: any) {
    return json(res, 500, { message: 'Database connection failed', error: e.message });
  }

  const method = (req.method || 'GET').toUpperCase();
  const pool = getPool();
  const id = getIdFromUrl(req.url);
  if (!id) return json(res, 400, { message: 'Invalid id' });

  if (method === 'GET') {
    try {
      const { rows } = await pool.query(
        `WITH base AS (
           SELECT 
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
           GROUP BY ts.id
         )
         SELECT 
           b.*, 
           COALESCE(
             json_agg(jsonb_build_object('studentEmail', tss.student_email, 'assignedAt', tss.assigned_at))
             FILTER (WHERE tss.id IS NOT NULL), '[]'::json
           ) AS students
         FROM base b
         LEFT JOIN training_session_students tss ON tss.training_session_id = b.id
         GROUP BY b.id, b.title, b.description, b.start_date, b.end_date, b.scenarios, b.student_count`,
        [id]
      );
      if (rows.length === 0) return json(res, 404, { message: 'Not found' });
      const base = mapAggregatedRowToSession(rows[0]);
      const trainingSession = {
        ...base,
        students: Array.isArray(rows[0].students) ? rows[0].students : [],
      };
      return json(res, 200, { trainingSession });
    } catch (e: any) {
      return json(res, 500, { message: 'Failed to fetch session', error: e.message });
    }
  }

  if (method === 'PUT') {
    try {
      const body = await parseBody(req);
      const {
        title,
        description,
        startDate,
        endDate,
        scenarioIds,
        studentEmails,
      } = body || {};

      // Start transaction
      await pool.query('BEGIN');
      try {
        // Update main fields if provided
        if (title !== undefined || description !== undefined || startDate !== undefined || endDate !== undefined) {
          const updates: string[] = [];
          const params: any[] = [];
          let idx = 1;
          if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title); }
          if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description || null); }
          if (startDate !== undefined) { updates.push(`start_date = $${idx++}`); params.push(new Date(startDate)); }
          if (endDate !== undefined) { updates.push(`end_date = $${idx++}`); params.push(new Date(endDate)); }
          if (updates.length > 0) {
            params.push(id);
            await pool.query(`UPDATE training_sessions SET ${updates.join(', ')} WHERE id = $${idx}` , params);
          }
        }

        // Update scenarios: replace set if provided
        if (Array.isArray(scenarioIds)) {
          const scenIds = scenarioIds.map((v: any) => Number(v)).filter((n: any) => Number.isInteger(n));
          await pool.query('DELETE FROM training_session_scenarios WHERE training_session_id = $1', [id]);
          if (scenIds.length > 0) {
            const values = scenIds.map((_, i) => `($1, $${i + 2})`).join(',');
            await pool.query(
              `INSERT INTO training_session_scenarios (training_session_id, scenario_id) VALUES ${values}`,
              [id, ...scenIds]
            );
          }
        }

        // Update students if provided
        if (Array.isArray(studentEmails)) {
          const provided = studentEmails.map(String).map((s) => s.trim()).filter((s) => s.length > 0);
          // Get existing
          const { rows: existingRows } = await pool.query(
            'SELECT student_email FROM training_session_students WHERE training_session_id = $1',
            [id]
          );
          const existingSet = new Set(existingRows.map((r: any) => String(r.student_email)));

          if (provided.length === 0) {
            // Explicitly clear all students
            await pool.query('DELETE FROM training_session_students WHERE training_session_id = $1', [id]);
          } else if (provided.every((e) => !existingSet.has(e))) {
            // Add-only: insert new ones; keep existing
            const values = provided.map((_, i) => `($1, $${i + 2})`).join(',');
            await pool.query(
              `INSERT INTO training_session_students (training_session_id, student_email) VALUES ${values}`,
              [id, ...provided]
            );
          } else {
            // Replace: set to exactly the provided list
            await pool.query('DELETE FROM training_session_students WHERE training_session_id = $1 AND student_email <> ALL($2::text[])', [id, provided]);
            const missing = provided.filter((e) => !existingSet.has(e));
            if (missing.length > 0) {
              const values = missing.map((_, i) => `($1, $${i + 2})`).join(',');
              await pool.query(
                `INSERT INTO training_session_students (training_session_id, student_email) VALUES ${values}`,
                [id, ...missing]
              );
            }
          }
        }

        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }

      // Return updated details
      const { rows } = await pool.query(
        `WITH base AS (
           SELECT 
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
           GROUP BY ts.id
         )
         SELECT 
           b.*, 
           COALESCE(
             json_agg(jsonb_build_object('studentEmail', tss.student_email, 'assignedAt', tss.assigned_at))
             FILTER (WHERE tss.id IS NOT NULL), '[]'::json
           ) AS students
         FROM base b
         LEFT JOIN training_session_students tss ON tss.training_session_id = b.id
         GROUP BY b.id, b.title, b.description, b.start_date, b.end_date, b.scenarios, b.student_count`,
        [id]
      );
      const base = mapAggregatedRowToSession(rows[0]);
      const trainingSession = {
        ...base,
        students: Array.isArray(rows[0].students) ? rows[0].students : [],
      };
      return json(res, 200, { trainingSession });
    } catch (e: any) {
      return json(res, 500, { message: 'Failed to update session', error: e.message });
    }
  }

  if (method === 'DELETE') {
    try {
      await pool.query('BEGIN');
      await pool.query('DELETE FROM training_session_students WHERE training_session_id = $1', [id]);
      await pool.query('DELETE FROM training_session_scenarios WHERE training_session_id = $1', [id]);
      await pool.query('DELETE FROM training_sessions WHERE id = $1', [id]);
      await pool.query('COMMIT');
      return json(res, 200, { success: true });
    } catch (e: any) {
      await pool.query('ROLLBACK');
      return json(res, 500, { message: 'Failed to delete session', error: e.message });
    }
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, PUT, DELETE');
  res.end();
}
