import type { CorsOptions } from 'cors';

/**
 * En producción, CORS_ORIGIN debe estar definido en Render (sync: false).
 * Sin esto, la API no debe arrancar sirviendo solo a localhost.
 */
export function validateProductionEnv(): string | null {
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN?.trim()) {
    return 'CORS_ORIGIN es obligatorio cuando NODE_ENV=production.';
  }
  return null;
}

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseOriginPattern(): RegExp | null {
  const patternRaw = process.env.CORS_ORIGIN_PATTERN?.trim();
  if (!patternRaw) {
    return null;
  }

  try {
    return new RegExp(patternRaw);
  } catch {
    throw new Error('CORS_ORIGIN_PATTERN no es una expresión regular válida.');
  }
}

/**
 * CORS_ORIGIN: orígenes exactos separados por coma (prod + local en dev).
 * CORS_ORIGIN_PATTERN (opcional): regex para previews de Vercel u otros subdominios.
 */
export function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGIN?.trim();

  if (!raw) {
    return { origin: 'http://localhost:5173' };
  }

  const allowed = parseAllowedOrigins(raw);
  const pattern = parseOriginPattern();

  if (!pattern) {
    return { origin: allowed.length === 1 ? allowed[0] : allowed };
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, false);
        return;
      }
      if (allowed.includes(origin) || pattern.test(origin)) {
        callback(null, origin);
        return;
      }
      callback(null, false);
    },
  };
}
