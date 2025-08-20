import type { IncomingMessage, ServerResponse } from 'http';
import { sbFromReq, requireAuthHeader } from '../_lib/supabase';

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
  const method = (req.method || 'GET').toUpperCase();
  const auth = requireAuthHeader(req);
  if (!auth.ok) return json(res, 401, { message: auth.message });
  const sb = sbFromReq(req);

  if (method === 'GET') {
    try {
      // 1) Fetch sessions
      const { data: sessions, error: sessErr } = await sb
        .from('training_sessions')
        .select('id,title,description,start_date,end_date,created_at')
        .order('created_at', { ascending: false });
      if (sessErr) throw sessErr;

      const ids = (sessions || []).map((s: any) => s.id);

      // 2) Fetch scenarios mapping with joined ecos_scenarios
      let tsc: any[] = [];
      if (ids.length > 0) {
        const { data, error } = await sb
          .from('training_session_scenarios')
          .select('training_session_id, ecos_scenarios(id,title,description)')
          .in('training_session_id', ids);
        if (error) throw error;
        tsc = data || [];
      }

      // 3) Fetch students for counts
      let tss: any[] = [];
      if (ids.length > 0) {
        const { data, error } = await sb
          .from('training_session_students')
          .select('training_session_id, student_email')
          .in('training_session_id', ids);
        if (error) throw error;
        tss = data || [];
      }

      // 4) Aggregate
      const scenBySession = new Map<number, any[]>();
      for (const row of tsc) {
        const sid = row.training_session_id as number;
        const scen = row.ecos_scenarios ? [{ id: row.ecos_scenarios.id, title: row.ecos_scenarios.title, description: row.ecos_scenarios.description }] : [];
        if (!scenBySession.has(sid)) scenBySession.set(sid, []);
        scenBySession.get(sid)!.push(...scen);
      }

      const studentCountBySession = new Map<number, number>();
      for (const row of tss) {
        const sid = row.training_session_id as number;
        studentCountBySession.set(sid, (studentCountBySession.get(sid) || 0) + 1);
      }

      const trainingSessions = (sessions || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        startDate: new Date(row.start_date).toISOString(),
        endDate: new Date(row.end_date).toISOString(),
        scenarios: scenBySession.get(row.id) || [],
        studentCount: studentCountBySession.get(row.id) || 0,
      }));

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
        email: createdByFromBody,
      } = body || {};

      if (!title || !startDate || !endDate) {
        return json(res, 400, { message: 'Missing required fields: title, startDate, endDate' });
      }

      // Resolve creator email from auth when possible
      let createdBy: string | null = null;
      try {
        const { data: userData } = await sb.auth.getUser();
        createdBy = (userData?.user?.email as string) || null;
      } catch {}
      if (!createdBy) createdBy = createdByFromBody || null;

      // Create session
      const { data: inserted, error: insErr } = await sb
        .from('training_sessions')
        .insert({
          title,
          description: description || null,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          created_by: createdBy,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const sessionId = inserted!.id as number;

      // Attach scenarios
      const scenIds = Array.isArray(scenarioIds) ? scenarioIds.map((v: any) => Number(v)).filter((n: any) => Number.isInteger(n)) : [];
      if (scenIds.length > 0) {
        const { error } = await sb
          .from('training_session_scenarios')
          .insert(scenIds.map((sid: number) => ({ training_session_id: sessionId, scenario_id: sid })));
        if (error) throw error;
      }

      // Attach students
      const emails = Array.isArray(studentEmails) ? studentEmails.map(String).filter((s) => s.length > 0) : [];
      if (emails.length > 0) {
        const { error } = await sb
          .from('training_session_students')
          .insert(emails.map((em: string) => ({ training_session_id: sessionId, student_email: em })));
        if (error) throw error;
      }

      // Build aggregated response
      const { data: sess } = await sb
        .from('training_sessions')
        .select('id,title,description,start_date,end_date')
        .eq('id', sessionId)
        .maybeSingle();

      let scenarios: any[] = [];
      let studentCount = 0;
      const { data: aggScen } = await sb
        .from('training_session_scenarios')
        .select('training_session_id, ecos_scenarios(id,title,description)')
        .eq('training_session_id', sessionId);
      scenarios = (aggScen || [])
        .map((r: any) => r?.ecos_scenarios)
        .filter(Boolean)
        .map((r: any) => ({ id: r.id, title: r.title, description: r.description }));

      const { data: aggStudents } = await sb
        .from('training_session_students')
        .select('id')
        .eq('training_session_id', sessionId);
      studentCount = (aggStudents || []).length;

      const trainingSession = {
        id: sess?.id,
        title: sess?.title,
        description: sess?.description ?? undefined,
        startDate: new Date(sess!.start_date).toISOString(),
        endDate: new Date(sess!.end_date).toISOString(),
        scenarios,
        studentCount,
      };

      return json(res, 201, { trainingSession });
    } catch (e: any) {
      return json(res, 500, { message: 'Failed to create session', error: e.message });
    }
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end();
}
