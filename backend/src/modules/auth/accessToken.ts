import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AuthUnavailableError, UnauthorizedError } from './errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Supabase firma los access tokens con claves asimétricas y publica las públicas
 * en JWKS. No se aceptan tokens HS256: la API no guarda ningún secret de firma.
 */
const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

export type AccessTokenConfig = {
  issuer: string;
  audience: 'authenticated';
  keys: JWTVerifyGetKey;
};

/** Un JWKS por URL: `jose` cachea las claves y las refresca ante un `kid` nuevo. */
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function remoteKeys(issuer: string): JWTVerifyGetKey {
  let keys = remoteKeySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    remoteKeySets.set(issuer, keys);
  }
  return keys;
}

/**
 * Lee la config del JWT de Supabase. Null si falta `SUPABASE_URL` o no es http(s).
 * `keys` reemplaza el JWKS remoto (tests). No hay valores por defecto.
 */
export function readAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  keys?: JWTVerifyGetKey,
): AccessTokenConfig | null {
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!supabaseUrl || !/^https?:\/\//.test(supabaseUrl)) {
    return null;
  }
  const issuer = `${supabaseUrl}/auth/v1`;
  return {
    issuer,
    audience: 'authenticated',
    keys: keys ?? remoteKeys(issuer),
  };
}

/**
 * Valida un access token de Supabase Auth contra el JWKS del proyecto.
 * Exige emisor, audiencia `authenticated`, vencimiento y `role = authenticated`.
 * No devuelve el email ni ningún otro claim.
 */
export async function verifyAccessToken(
  token: string,
  config: AccessTokenConfig,
): Promise<{ authUserId: string }> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, config.keys, {
      algorithms: ALLOWED_ALGORITHMS,
      issuer: config.issuer,
      audience: config.audience,
      requiredClaims: ['exp', 'sub'],
    }));
  } catch (error) {
    // Si el JWKS no se pudo descargar no es culpa del token: 503, no 401.
    if (error instanceof joseErrors.JWKSTimeout || !(error instanceof joseErrors.JOSEError)) {
      throw new AuthUnavailableError();
    }
    throw new UnauthorizedError();
  }

  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw new UnauthorizedError();
  }

  if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' || !UUID_PATTERN.test(payload.sub)) {
    throw new UnauthorizedError();
  }

  return { authUserId: payload.sub };
}
