import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { clubIdFromHeader } from '../../infrastructure/logging/logger';
import { captureError, moduleFromPath } from '../../infrastructure/observability/sentry';
import { isUniqueViolation } from '../errors/http-error';

function statusOf(err: unknown): number {
  if (typeof err !== 'object' || err === null) return 500;
  if ('type' in err && err.type === 'entity.parse.failed') return 400;
  if (isUniqueViolation(err)) return 409;
  if ('status' in err && typeof err.status === 'number') return err.status;
  return 500;
}

/**
 * Error handler único de la API. Los errores 4xx devuelven su mensaje; los 5xx,
 * un mensaje genérico (el stack solo fuera de producción) y se reportan a Sentry.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const status = statusOf(err);
  let message = 'Internal Server Error';
  if (status === 409 && isUniqueViolation(err)) {
    message = 'Ya existe un registro con esos datos';
  } else if (
    status < 500 &&
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof err.message === 'string'
  ) {
    message = err.message;
  }
  const body: { error: string; stack?: string } = { error: message };

  if (
    process.env.NODE_ENV !== 'production' &&
    typeof err === 'object' &&
    err !== null &&
    'stack' in err &&
    typeof err.stack === 'string'
  ) {
    body.stack = err.stack;
  }

  if (status >= 500) {
    const requestId = res.getHeader('X-Request-Id');
    captureError(err, {
      module: moduleFromPath(req.path),
      clubId: clubIdFromHeader(req.get('X-Organization-Id')),
      requestId: typeof requestId === 'string' ? requestId : null,
    });
  }

  res.status(status).json(body);
};
