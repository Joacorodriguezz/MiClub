import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload, type KeyLike } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { readAuthConfig, verifyAccessToken, type AccessTokenConfig } from './accessToken';
import { UnauthorizedError } from './errors';

const ISSUER = 'http://127.0.0.1:54321/auth/v1';
const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';
const KID = 'test-key';

let privateKey: KeyLike;
let otherPrivateKey: KeyLike;
let config: AccessTokenConfig;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  const other = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'ES256' };
  config = { issuer: ISSUER, audience: 'authenticated', keys: createLocalJWKSet({ keys: [jwk] }) };
});

type SignOptions = {
  key?: KeyLike | Uint8Array;
  alg?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string | null;
};

async function sign(claims: JWTPayload, options: SignOptions = {}): Promise<string> {
  const jwt = new SignJWT({ role: 'authenticated', sub: AUTH_USER_ID, ...claims })
    .setProtectedHeader({ alg: options.alg ?? 'ES256', kid: KID })
    .setIssuedAt()
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? 'authenticated');
  if (options.expiresIn !== null) {
    jwt.setExpirationTime(options.expiresIn ?? '1h');
  }
  return jwt.sign(options.key ?? privateKey);
}

describe('verifyAccessToken', () => {
  it('devuelve solo el id de auth, aunque el token traiga email', async () => {
    const token = await sign({ email: 'persona@example.com' });
    await expect(verifyAccessToken(token, config)).resolves.toEqual({ authUserId: AUTH_USER_ID });
  });

  it('rechaza un token firmado sin claim exp', async () => {
    const token = await sign({}, { expiresIn: null });
    await expect(verifyAccessToken(token, config)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rechaza firma, emisor, audiencia, vencimiento, HS256 y service_role', async () => {
    const cases = [
      await sign({}, { expiresIn: '-10s' }),
      await sign({}, { key: otherPrivateKey }),
      await sign({}, { issuer: 'https://otro.example/auth/v1' }),
      await sign({}, { audience: 'anon' }),
      // Un token HS256 no se acepta aunque el header traiga el kid correcto.
      await sign({}, { alg: 'HS256', key: new TextEncoder().encode('test-only-secret-de-32-caracteres!') }),
      await sign({ role: 'service_role' }),
      await sign({ sub: 'no-es-uuid' }),
    ];

    for (const token of cases) {
      await expect(verifyAccessToken(token, config)).rejects.toBeInstanceOf(UnauthorizedError);
    }
  });
});

describe('readAuthConfig', () => {
  it('exige SUPABASE_URL http(s) y arma el issuer sin barra final', () => {
    expect(readAuthConfig({})).toBeNull();
    expect(readAuthConfig({ SUPABASE_URL: 'no-es-url' })).toBeNull();
    const read = readAuthConfig({ SUPABASE_URL: 'http://127.0.0.1:54321/' }, config.keys);
    expect(read).toEqual({ issuer: ISSUER, audience: 'authenticated', keys: config.keys });
  });
});
