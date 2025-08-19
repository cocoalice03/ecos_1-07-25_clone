import type { IncomingMessage, ServerResponse } from 'http';
import { ensureConnected, getPool } from ../lib/db;

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

    const { rows } = await pool.query(
      `SELECT id, title, description FROM ecos_scenarios ORDER BY created_at DESC`
    );

    return json(res, 200, {
      scenarios: rows,
      connected: true,
      source: 'database',
    });
  } catch (e: any) {
    return json(res, 500, {
      message: "Erreur de connexion à la base de données",
      error: e?.message || 'unknown',
      connected: false,
    });
  }
}
