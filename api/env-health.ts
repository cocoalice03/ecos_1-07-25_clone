import type { IncomingMessage, ServerResponse } from 'http';

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0);
  const node = process.version;
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_URL.length > 0);
  const hasSupabaseAnonKey = Boolean(process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.length > 0);
  const hasSupabaseServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE && process.env.SUPABASE_SERVICE_ROLE.length > 0);
  return json(res, 200, {
    ok: true,
    node,
    hasDatabaseUrl,
    hasSupabaseUrl,
    hasSupabaseAnonKey,
    hasSupabaseServiceRole,
  });
}
