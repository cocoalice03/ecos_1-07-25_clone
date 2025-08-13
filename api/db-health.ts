import type { IncomingMessage, ServerResponse } from 'http';
import { ensureConnected } from './lib/db';

function json(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureConnected();
    return json(res, 200, { ok: true });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || 'unknown' });
  }
}
