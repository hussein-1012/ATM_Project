import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/**
 * pino-http id generator: reuse safe inbound x-request-id, else create one.
 * Kept in sync with the Express-level middleware via req.id.
 */
export function genReqId(req: IncomingMessage): string {
  const existing = (req as { id?: string }).id;
  if (existing) return existing;
  const inbound = req.headers['x-request-id'];
  const id =
    typeof inbound === 'string' && /^[\w.-]{1,64}$/.test(inbound) ? inbound : randomUUID();
  (req as { id?: string }).id = id;
  return id;
}
