import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { buildCorsOptions } from './config/cors';
import { log } from './infrastructure/logging/logger';
import { requestLogger } from './infrastructure/logging/requestLog';
import { captureError } from './infrastructure/observability/sentry';
import { createSessionRouter, type SessionAuth } from './modules/auth/router';
import { createFinanceRouter } from './modules/finance/finance.routes';
import { createPaymentsRouter } from './modules/payments/payments.routes';
import { errorHandler } from './shared/http/error-handler';

/**
 * Sonda de readiness. El default ejecuta `SELECT 1` contra DATABASE_URL.
 * En el servidor, con auth configurada, prueba el rol de runtime.
 */
export type ReadinessProbe = () => Promise<unknown>;

/** La sonda no puede colgar el health check de Render. */
const READINESS_TIMEOUT_MS = 2000;
/** Un monitor frecuente no golpea la base en cada request. */
const READINESS_CACHE_MS = 5000;

function withTimeout(probe: ReadinessProbe, ms: number): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('readiness timeout')), ms);
  });
  return Promise.race([probe(), timeout]).finally(() => clearTimeout(timer));
}

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
 * Cada módulo de `src/modules/*` expone su router y se monta acá; los de
 * negocio, bajo `/api/v1` y detrás del middleware de auth.
 * No agregar lógica de dominio en este archivo.
 */
export function createApp(options?: {
  readinessProbe?: ReadinessProbe;
  auth?: SessionAuth;
}): Express {
  const readinessProbe = options?.readinessProbe ?? defaultReadinessProbe;
  let lastReadiness: { ok: boolean; at: number } | null = null;
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
    if (lastReadiness && Date.now() - lastReadiness.at < READINESS_CACHE_MS) {
      res
        .status(lastReadiness.ok ? 200 : 503)
        .json({ status: lastReadiness.ok ? 'ok' : 'unavailable' });
      return;
    }
    try {
      await withTimeout(readinessProbe, READINESS_TIMEOUT_MS);
      lastReadiness = { ok: true, at: Date.now() };
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      // Mientras dura el cache, un fallo repetido no vuelve a loguear ni a ir a Sentry.
      lastReadiness = { ok: false, at: Date.now() };
      const requestId = res.getHeader('X-Request-Id');
      log({
        level: 'error',
        msg: 'ready: la base no respondió',
        request_id: typeof requestId === 'string' ? requestId : null,
        club_id: null,
      });
      captureError(error, {
        module: 'platform',
        clubId: null,
        requestId: typeof requestId === 'string' ? requestId : null,
      });
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use(createSessionRouter(options?.auth));
  app.use('/api/v1', createFinanceRouter(options?.auth));
  app.use('/api/v1', createPaymentsRouter(options?.auth));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
}
