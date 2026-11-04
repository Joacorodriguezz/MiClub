import { createApp } from './app';
import { buildCorsOptions, validateProductionEnv } from './config/cors';
import { createRuntimeClient } from './infrastructure/database/runtimeClient';
import { log } from './infrastructure/logging/logger';
import { initSentry } from './infrastructure/observability/sentry';
import { readAuthConfig } from './modules/auth/accessToken';

/**
 * Punto de entrada del proceso. Levanta el servidor HTTP.
 * Render inyecta PORT; en local usa 3000. Bind 0.0.0.0 para el Web Service.
 */
if (!initSentry()) {
  log({ level: 'info', msg: 'Sentry desactivado: falta SENTRY_DSN' });
}

const productionEnvError = validateProductionEnv();
if (productionEnvError) {
  log({ level: 'error', msg: productionEnvError });
  process.exit(1);
}

try {
  buildCorsOptions();
} catch (error) {
  log({
    level: 'error',
    msg: error instanceof Error ? error.message : 'Error al configurar CORS.',
  });
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp({ auth: createAuth() });

function createAuth(): { runtimeClient: ReturnType<typeof createRuntimeClient> } | undefined {
  const databaseUrl = process.env.RUNTIME_DATABASE_URL?.trim();
  if (!databaseUrl || !readAuthConfig()) {
    log({
      level: 'error',
      msg: 'Auth deshabilitada: faltan RUNTIME_DATABASE_URL, SUPABASE_URL o SUPABASE_JWT_SECRET (mínimo 32 caracteres).',
    });
    return undefined;
  }
  return { runtimeClient: createRuntimeClient(databaseUrl) };
}

app.listen(PORT, '0.0.0.0', () => {
  log({ level: 'info', msg: 'escuchando' });
});
