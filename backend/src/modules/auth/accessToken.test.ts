import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { readAuthConfig, verifyAccessToken, type AccessTokenConfig } from './accessToken';
import { UnauthorizedError } from './errors';

const SECRET = 'test-only-supabase-jwt-secret-32b';
const ISSUER = 'http://127.0.0.1:54321/auth/v1';
const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';

const config: AccessTokenConfig = {
  secret: SECRET,
  issuer: ISSUER,
  audience: 'authenticated',
};

function sign(claims: Record<string, unknown>, options?: jwt.SignOptions): string {
  return jwt.sign({ role: 'authenticated', sub: AUTH_USER_ID, ...claims }, SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    audience: 'authenticated',
    issuer: ISSUER,
    ...options,
  });
}

describe('verifyAccessToken', () => {
  it('devuelve solo el id de auth, aunque el token traiga email', () => {
    const token = sign({ email: 'persona@example.com' });
    expect(verifyAccessToken(token, config)).toEqual({ authUserId: AUTH_USER_ID });
  });

  it('rechaza firma, emisor, audiencia, vencimiento, otro algoritmo y service_role', () => {
    const cases = [
      sign({}, { expiresIn: '-10s' }),
      jwt.sign({ sub: AUTH_USER_ID, role: 'authenticated' }, 'otra-clave-distinta-de-32-caracteres', {
        algorithm: 'HS256',
        expiresIn: '1h',
        audience: 'authenticated',
        issuer: ISSUER,
      }),
      sign({}, { issuer: 'https://otro.example/auth/v1' }),
      sign({}, { audience: 'anon' }),
      jwt.sign({ sub: AUTH_USER_ID, role: 'authenticated' }, SECRET, {
        algorithm: 'HS384',
        expiresIn: '1h',
        audience: 'authenticated',
        issuer: ISSUER,
      }),
      sign({ role: 'service_role' }),
      sign({ sub: 'no-es-uuid' }),
    ];

    for (const token of cases) {
      expect(() => verifyAccessToken(token, config)).toThrow(UnauthorizedError);
    }
  });
});

describe('readAuthConfig', () => {
  it('exige URL y un secret de al menos 32 caracteres', () => {
    expect(readAuthConfig({})).toBeNull();
    expect(readAuthConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_JWT_SECRET: 'corto' })).toBeNull();
    expect(
      readAuthConfig({ SUPABASE_URL: 'http://127.0.0.1:54321/', SUPABASE_JWT_SECRET: SECRET }),
    ).toEqual(config);
  });
});
