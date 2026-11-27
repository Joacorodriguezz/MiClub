import type { PrismaClient } from '@prisma/client';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey, type KeyLike } from 'jose';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';

const ISSUER = 'http://127.0.0.1:54321/auth/v1';
const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';

function untouchedClient(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get() {
      throw new Error('el middleware tocó la base');
    },
  });
}

let privateKey: KeyLike;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'ES256' }] });
});

async function bearer(): Promise<string> {
  const token = await new SignJWT({ sub: AUTH_USER_ID, role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey);
  return `Bearer ${token}`;
}

describe('GET /session sin base', () => {
  afterEach(() => {
    delete process.env.SUPABASE_URL;
  });

  it('responde 503 si la app no tiene auth, y /health sigue abierto', async () => {
    const app = createApp();
    const session = await request(app).get('/session');
    const health = await request(app).get('/health');

    expect(session.status).toBe(503);
    expect(session.body).toEqual({ error: 'Auth no configurada' });
    expect(health.status).toBe(200);
  });

  it('responde 401 sin token y 400 con organización inválida, sin consultar la base', async () => {
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
    const app = createApp({ auth: { runtimeClient: untouchedClient(), keys } });

    const missing = await request(app).get('/session');
    const badOrg = await request(app)
      .get('/session')
      .set('Authorization', await bearer())
      .set('X-Organization-Id', 'club-a');

    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'No autorizado' });
    expect(badOrg.status).toBe(400);
    expect(badOrg.body).toEqual({ error: 'Organización inválida' });
  });
});
