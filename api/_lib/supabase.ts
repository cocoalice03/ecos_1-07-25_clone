import type { IncomingMessage } from 'http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is not set`);
  return val;
}

export function getBearerFromAuthHeader(req: IncomingMessage): string | null {
  const auth = (req.headers?.authorization || req.headers?.Authorization) as string | undefined;
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

export function sbFromReq(req: IncomingMessage): SupabaseClient {
  const url = requiredEnv('SUPABASE_URL');
  const anon = requiredEnv('SUPABASE_ANON_KEY');
  const token = getBearerFromAuthHeader(req);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return createClient(url, anon, {
    global: { headers },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function sbAdmin(): SupabaseClient {
  const url = requiredEnv('SUPABASE_URL');
  const service = requiredEnv('SUPABASE_SERVICE_ROLE');
  return createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function requireAuthHeader(req: IncomingMessage): { ok: boolean; token?: string; message?: string } {
  const token = getBearerFromAuthHeader(req);
  if (!token) return { ok: false, message: 'Missing Authorization: Bearer <token>' };
  return { ok: true, token };
}
