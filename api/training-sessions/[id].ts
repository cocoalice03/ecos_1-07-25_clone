import type { IncomingMessage, ServerResponse } from 'http';
import { sbFromReq, requireAuthHeader } from '../_lib/supabase';
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
  const method = (req.method || 'GET').toUpperCase();
  const auth = requireAuthHeader(req);
  if (!auth.ok) return json(res, 401, { message: auth.message });
  const sb = sbFromReq(req);
  const id = getIdFromUrl(req.url);
  if (!id) return json(res, 400, { message: 'Invalid id' });

  if (method === 'GET') {
    try {
      // Base session
      const { data: sess, error: sErr } = await sb
        .from('training_sessions')
        .select('id,title,description,start_date,end_date')
        .eq('id', id)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!sess) return json(res, 404, { message: 'Not found' });

      // Scenarios
      const { data: tsc } = await sb
        .from('training_session_scenarios')
        .select('training_session_id, ecos_scenarios(id,title,description)')
        .eq('training_session_id', id);
      const scenarios = (tsc || [])
        .map((r: any) => r?.ecos_scenarios)
        .filter(Boolean)
        .map((r: any) => ({ id: r.id, title: r.title, description: r.description }));

      // Students list
      const { data: tss } = await sb
        .from('training_session_students')
        .select('student_email, assigned_at')
        .eq('training_session_id', id);
      const students = (tss || []).map((r: any) => ({ studentEmail: r.student_email, assignedAt: r.assigned_at }));

      const trainingSession = {
        id: sess.id,
        title: sess.title,
        description: sess.description ?? undefined,
        startDate: new Date(sess.start_date).toISOString(),
        endDate: new Date(sess.end_date).toISOString(),
        scenarios,
        studentCount: students.length,
        students,
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

      // Update main fields if provided
      const updates: Record<string, any> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description || null;
      if (startDate !== undefined) updates.start_date = new Date(startDate).toISOString();
      if (endDate !== undefined) updates.end_date = new Date(endDate).toISOString();
      if (Object.keys(updates).length > 0) {
        const { error } = await sb
          .from('training_sessions')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      }

      // Update scenarios: replace set if provided
      if (Array.isArray(scenarioIds)) {
        const scenIds = scenarioIds.map((v: any) => Number(v)).filter((n: any) => Number.isInteger(n));
        const { error: delErr } = await sb
          .from('training_session_scenarios')
          .delete()
          .eq('training_session_id', id);
        if (delErr) throw delErr;
        if (scenIds.length > 0) {
          const { error: insErr } = await sb
            .from('training_session_scenarios')
            .insert(scenIds.map((sid: number) => ({ training_session_id: id, scenario_id: sid })));
          if (insErr) throw insErr;
        }
      }

      // Update students if provided
      if (Array.isArray(studentEmails)) {
        const provided: string[] = studentEmails.map(String).map((s) => s.trim()).filter((s) => s.length > 0);
        // Get existing
        const { data: existingRows, error: exErr } = await sb
          .from('training_session_students')
          .select('student_email')
          .eq('training_session_id', id);
        if (exErr) throw exErr;
        const existingSet = new Set((existingRows || []).map((r: any) => String(r.student_email)));

        if (provided.length === 0) {
          // Explicitly clear all students
          const { error } = await sb
            .from('training_session_students')
            .delete()
            .eq('training_session_id', id);
          if (error) throw error;
        } else if (provided.every((e) => !existingSet.has(e))) {
          // Add-only: insert new ones; keep existing
          const { error } = await sb
            .from('training_session_students')
            .insert(provided.map((em) => ({ training_session_id: id, student_email: em })));
          if (error) throw error;
        } else {
          // Replace: set to exactly the provided list
          // Delete those not in provided
          const { error: delErr } = await sb
            .from('training_session_students')
            .delete()
            .eq('training_session_id', id)
            .not('student_email', 'in', provided);
          if (delErr) throw delErr;
          // Insert missing
          const missing = provided.filter((e) => !existingSet.has(e));
          if (missing.length > 0) {
            const { error: insErr } = await sb
              .from('training_session_students')
              .insert(missing.map((em) => ({ training_session_id: id, student_email: em })));
            if (insErr) throw insErr;
          }
        }
      }

      // Return updated details
      const { data: sess } = await sb
        .from('training_sessions')
        .select('id,title,description,start_date,end_date')
        .eq('id', id)
        .maybeSingle();
      const { data: tsc } = await sb
        .from('training_session_scenarios')
        .select('training_session_id, ecos_scenarios(id,title,description)')
        .eq('training_session_id', id);
      const scenarios = (tsc || [])
        .map((r: any) => r?.ecos_scenarios)
        .filter(Boolean)
        .map((r: any) => ({ id: r.id, title: r.title, description: r.description }));
      const { data: tss } = await sb
        .from('training_session_students')
        .select('student_email, assigned_at')
        .eq('training_session_id', id);
      const students = (tss || []).map((r: any) => ({ studentEmail: r.student_email, assignedAt: r.assigned_at }));

      const trainingSession = {
        id: sess?.id,
        title: sess?.title,
        description: sess?.description ?? undefined,
        startDate: sess ? new Date(sess.start_date).toISOString() : undefined,
        endDate: sess ? new Date(sess.end_date).toISOString() : undefined,
        scenarios,
        studentCount: students.length,
        students,
      };
      return json(res, 200, { trainingSession });
    } catch (e: any) {
      return json(res, 500, { message: 'Failed to update session', error: e.message });
    }
  }

  if (method === 'DELETE') {
    try {
      const { error: err1 } = await sb
        .from('training_session_students')
        .delete()
        .eq('training_session_id', id);
      if (err1) throw err1;
      const { error: err2 } = await sb
        .from('training_session_scenarios')
        .delete()
        .eq('training_session_id', id);
      if (err2) throw err2;
      const { error: err3 } = await sb
        .from('training_sessions')
        .delete()
        .eq('id', id);
      if (err3) throw err3;
      return json(res, 200, { success: true });
    } catch (e: any) {
      return json(res, 500, { message: 'Failed to delete session', error: e.message });
    }
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, PUT, DELETE');
  res.end();
}
