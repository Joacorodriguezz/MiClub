import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AccessTokenConfig = {
  secret: string;
  issuer: string;
  audience: 'authenticated';
};

/**
 * Lee la config del JWT de Supabase. Null si falta la URL, el secret, o el
 * secret tiene menos de 32 caracteres. No hay valores por defecto.
 */
export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AccessTokenConfig | null {
  const secret = env.SUPABASE_JWT_SECRET?.trim();
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!secret || secret.length < 32 || !supabaseUrl) {
    return null;
  }
  return {
    secret,
    issuer: `${supabaseUrl}/auth/v1`,
    audience: 'authenticated',
  };
}

/**
 * Valida un access token de Supabase Auth (HS256).
 * Exige emisor, audiencia `authenticated`, vencimiento y `role = authenticated`.
 * No devuelve el email ni ningún otro claim.
 */
export function verifyAccessToken(token: string, config: AccessTokenConfig): { authUserId: string } {
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, config.secret, {
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience,
    });
    if (typeof decoded === 'string') {
      throw new UnauthorizedError();
    }
    payload = decoded;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError();
  }

  if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' || !UUID_PATTERN.test(payload.sub)) {
    throw new UnauthorizedError();
  }

  return { authUserId: payload.sub };
}
