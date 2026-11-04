import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { clubIdFromHeader, log } from './logger';

/**
 * Log de cada response. No escribe el body, la query ni los headers:
 * ahí pueden venir el token, un email o un DNI.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    log({
      level: res.statusCode >= 500 ? 'error' : 'info',
      msg: 'request',
      request_id: requestId,
      club_id: clubIdFromHeader(req.get('X-Organization-Id')),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Math.round(durationMs),
    });
  });

  next();
}
