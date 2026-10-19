import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Ensures every request carries an id: reuses an inbound x-request-id
 * when it looks safe, otherwise generates a UUID. The id is attached to
 * req.id and consumed by the pino logger (child context).
 */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  const id =
    typeof inbound === 'string' && /^[\w.-]{1,64}$/.test(inbound) ? inbound : randomUUID();
  (req as { id?: string }).id = id;
  res.setHeader('x-request-id', id);
  next();
};
