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

    // Prefer user token; if absent, allow only users marked as admins (users.is_admin=true)
    async function getClient(): Promise<ReturnType<typeof sbFromReq> | ReturnType<typeof sbAdmin> | null> {
      const hasAuth = requireAuthHeader(req).ok;
      if (hasAuth) return sbFromReq(req);

      if (!email) return null;
      const adminClient = sbAdmin();
      const { data, error } = await adminClient
        .from('users')
        .select('is_admin')
        .eq('email', email)
        .maybeSingle();
      if (error) return null;
      if (data?.is_admin === true) return adminClient;
      return null;
    }

    const sb = await getClient();

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

