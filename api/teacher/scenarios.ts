import type { IncomingMessage, ServerResponse } from 'http';
import { sbFromReq, sbAdmin, requireAuthHeader } from '../_lib/supabase';

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

    // Prefer user token; fallback to admin-only email using service role
    const hasAuth = requireAuthHeader(req).ok;
    const sb = hasAuth
      ? sbFromReq(req)
      : isAdminAuthorized(email)
        ? sbAdmin()
        : null;

    if (!sb) {
      return json(res, 403, { message: 'Accès non autorisé' });
    }

    const { data, error } = await sb
      .from('ecos_scenarios')
      .select('id,title,description')
      .order('created_at', { ascending: false });

    if (error) {
      return json(res, 500, { message: 'Erreur lors de la récupération des scénarios', error: error.message });
    }

    return json(res, 200, { scenarios: data ?? [] });
  } catch (e: any) {
    return json(res, 500, { message: 'Erreur lors de la récupération des scénarios', error: e?.message || 'unknown' });
  }
}

