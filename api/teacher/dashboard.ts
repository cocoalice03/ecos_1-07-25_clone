import type { IncomingMessage, ServerResponse } from 'http';
import { sbFromReq, sbAdmin, requireAuthHeader } from '../_lib/supabase';

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const email = url.searchParams.get('email');

    // Helper: if no Authorization header, allow admin access only if the email belongs to a user with users.is_admin=true
    async function getClient(): Promise<ReturnType<typeof sbFromReq> | ReturnType<typeof sbAdmin> | null> {
      const hasAuth = requireAuthHeader(req).ok;
      if (hasAuth) return sbFromReq(req);

      // No auth header: check if the provided email is an admin
      if (!email) return null;
      const adminClient = sbAdmin();
      const { data, error } = await adminClient
        .from('users')
        .select('is_admin')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        // Fail closed if user check fails
        return null;
      }
      if (data?.is_admin === true) return adminClient;
      return null;
    }

    const sb = await getClient();

    if (!sb) {
      return json(res, 403, { message: 'Accès non autorisé' });
    }

    const nowIso = new Date().toISOString();

    const [scenariosHead, activeHead, completedHead, studentsList] = await Promise.all([
      sb.from('ecos_scenarios').select('*', { count: 'exact', head: true }),
      sb.from('training_sessions')
        .select('*', { count: 'exact', head: true })
        .lte('start_date', nowIso)
        .gte('end_date', nowIso),
      sb.from('training_sessions')
        .select('*', { count: 'exact', head: true })
        .lt('end_date', nowIso),
      sb.from('training_session_students').select('student_email'),
    ]);

    if (scenariosHead.error || activeHead.error || completedHead.error || studentsList.error) {
      const errMsg = scenariosHead.error?.message || activeHead.error?.message || completedHead.error?.message || studentsList.error?.message || 'unknown';
      return json(res, 500, { message: 'Erreur lors de la récupération des statistiques', error: errMsg });
    }

    const totalScenarios = scenariosHead.count ?? 0;
    const activeSessions = activeHead.count ?? 0;
    const completedSessions = completedHead.count ?? 0;
    const emails = (studentsList.data ?? []).map((r: any) => r.student_email).filter(Boolean);
    const totalStudents = Array.from(new Set(emails)).length;

    return json(res, 200, { totalScenarios, activeSessions, completedSessions, totalStudents });
  } catch (e: any) {
    return json(res, 500, { message: 'Erreur lors de la récupération des statistiques', error: e?.message || 'unknown' });
  }
}

