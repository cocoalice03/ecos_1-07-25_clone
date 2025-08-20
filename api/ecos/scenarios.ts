import type { IncomingMessage, ServerResponse } from 'http';
import { sbFromReq } from '../_lib/supabase';

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const sb = sbFromReq(req);

  if (method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end();
  }

  try {
    const { data, error } = await sb
      .from('ecos_scenarios')
      .select('id,title,description')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const scenarios = (data || []).map((r: any) => ({ id: r.id, title: r.title, description: r.description }));
    return json(res, 200, { scenarios });
  } catch (e: any) {
    return json(res, 500, { message: 'Failed to fetch scenarios', error: e.message });
  }
}
