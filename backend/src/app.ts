import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { buildCorsOptions } from './config/cors';
import { log } from './infrastructure/logging/logger';
import { requestLogger } from './infrastructure/logging/requestLog';
import { createSessionRouter, type SessionAuth } from './modules/auth/router';

/** Sonda de readiness. El default ejecuta `SELECT 1` contra DATABASE_URL. */
export type ReadinessProbe = () => Promise<unknown>;

/**
 * Carga el cliente Prisma solo al atender `/ready`, para que `/health` y los
 * tests que no tocan la base puedan importar la app sin DATABASE_URL.
 */
async function defaultReadinessProbe(): Promise<void> {
  const { checkDatabase } = await import('./infrastructure/database/readiness');
  await checkDatabase();
}

/**
 * Construye la aplicación Express (sin rutas de negocio todavía).
 *
 * Los módulos de `src/modules/*` registran aquí sus routers.
 * No agregar lógica de dominio en este archivo.
 */
export function createApp(options?: {
  readinessProbe?: ReadinessProbe;
  auth?: SessionAuth;
}): Express {
  const readinessProbe = options?.readinessProbe ?? defaultReadinessProbe;
  const app = express();

  // CORS antes del body parser: JSON inválido sigue respondiendo con headers CORS.
  app.use(cors(buildCorsOptions()));
  app.use(requestLogger);
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: la base responde. El error no se devuelve: puede incluir el DSN.
  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      await readinessProbe();
      res.status(200).json({ status: 'ok' });
    } catch {
      const requestId = res.getHeader('X-Request-Id');
      log({
        level: 'error',
        msg: 'ready: la base no respondió',
        request_id: typeof requestId === 'string' ? requestId : null,
        club_id: null,
      });
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use(createSessionRouter(options?.auth));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  const errorHandler: ErrorRequestHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const status =
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      err.type === 'entity.parse.failed'
        ? 400
        : typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
          ? err.status
          : 500;
    let message = 'Internal Server Error';
    if (
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

    res.status(status).json(body);
  };

  app.use(errorHandler);

  return app;
}
