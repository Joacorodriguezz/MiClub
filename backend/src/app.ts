import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { buildCorsOptions } from './config/cors';
import { createFinanceRouter } from './modules/finance/finance.routes';
import { createPaymentsRouter } from './modules/payments/payments.routes';
import { errorHandler } from './shared/http/error-handler';

/**
 * Construye la aplicación Express.
 *
 * Cada módulo de `src/modules/*` expone su router y se monta acá, bajo `/api/v1`.
 * No agregar lógica de dominio en este archivo.
 */
export function createApp(): Express {
  const app = express();

  // CORS antes del body parser: JSON inválido sigue respondiendo con headers CORS.
  app.use(cors(buildCorsOptions()));
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1', createFinanceRouter());
  app.use('/api/v1', createPaymentsRouter());

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
}
