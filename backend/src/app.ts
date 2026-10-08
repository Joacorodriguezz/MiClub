import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

/**
 * Construye la aplicación Express (sin rutas de negocio todavía).
 *
 * Los módulos de `src/modules/*` registrarán aquí sus routers más adelante.
 * No agregar lógica de dominio en este archivo.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    }),
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

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
      typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
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
