import type { IncomingMessage, ServerResponse } from 'http';
import { ensureConnected, getPool } from '../lib/db.js';

const ADMIN_EMAILS: string[] = [
  'cherubindavid@gmail.com',
  'colombemadoungou@gmail.com',
  'colombemadoungou.com',
  'romain.guillevic@gmail.com',
  'romainguillevic@gmail.com',
];

function isAdminAuthorized(email: string | null): boolean {
  if (!email) return false;
  const norm = email.toLowerCase().trim();
  return ADMIN_EMAILS.map(e => e.toLowerCase().trim()).includes(norm);
}

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const email = url.searchParams.get('email');

    if (!isAdminAuthorized(email)) {
      return json(res, 403, { message: 'Accès non autorisé' });
    }

    await ensureConnected();
    const pool = getPool();

    const [scenariosCount, activeSessionsCount, completedSessionsCount, totalStudentsCount] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM ecos_scenarios`),
      pool.query(`SELECT COUNT(*)::int AS count FROM training_sessions WHERE start_date <= NOW() AND end_date >= NOW()`),
      pool.query(`SELECT COUNT(*)::int AS count FROM training_sessions WHERE end_date < NOW()`),
      pool.query(`SELECT COUNT(DISTINCT student_email)::int AS count FROM training_session_students`),
    ]);

    const totalScenarios = scenariosCount.rows[0]?.count ?? 0;
    const activeSessions = activeSessionsCount.rows[0]?.count ?? 0;
    const completedSessions = completedSessionsCount.rows[0]?.count ?? 0;
    const totalStudents = totalStudentsCount.rows[0]?.count ?? 0;

    return json(res, 200, {
      totalScenarios,
      activeSessions,
      completedSessions,
      totalStudents,
    });
  } catch (e: any) {
    return json(res, 500, { message: 'Erreur lors de la récupération des statistiques', error: e?.message || 'unknown' });
  }
}
