import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/**
 * Auth contra Postgres real, con el mismo par de conexiones que CI:
 * - `DATABASE_URL`: rol de migraciones. Solo siembra.
 * - `RUNTIME_DATABASE_URL`: rol de la API, sin SUPERUSER ni BYPASSRLS.
 * Si el cliente de la API es el de migraciones, el test del rol falla y
 * `GET /session` responde 503 sin leer datos del club.
 */
const SECRET = 'test-only-supabase-jwt-secret-32b';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const ISSUER = `${SUPABASE_URL}/auth/v1`;

function requiredUrl(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} para el test de auth`);
  }
  return value;
}

const admin = new PrismaClient({ datasourceUrl: requiredUrl('DATABASE_URL') });
const runtime = new PrismaClient({ datasourceUrl: requiredUrl('RUNTIME_DATABASE_URL') });

const suffix = randomUUID().slice(0, 8);
let orgA: string;
let orgB: string;
let authA: string;
let authC: string;
let userA: string;
let userB: string;
let userC: string;

function sign(authUserId: string): string {
  return jwt.sign({ sub: authUserId, role: 'authenticated', email: `persona-${suffix}@test.local` }, SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    audience: 'authenticated',
    issuer: ISSUER,
  });
}

beforeAll(async () => {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_JWT_SECRET = SECRET;

  const [a, b] = await Promise.all([
    admin.organization.create({ data: { name: 'Club A', slug: `club-a-${suffix}` } }),
    admin.organization.create({ data: { name: 'Club B', slug: `club-b-${suffix}` } }),
  ]);
  orgA = a.id;
  orgB = b.id;

  authA = randomUUID();
  authC = randomUUID();
  const [ua, ub, uc] = await Promise.all([
    admin.user.create({ data: { authUserId: authA, email: `a-${suffix}@test.local` } }),
    admin.user.create({ data: { authUserId: randomUUID(), email: `b-${suffix}@test.local` } }),
    admin.user.create({ data: { authUserId: authC, email: `c-${suffix}@test.local` } }),
  ]);
  userA = ua.id;
  userB = ub.id;
  userC = uc.id;

  await Promise.all([
    admin.organizationMembership.create({ data: { organizationId: orgA, userId: userA, role: 'OWNER' } }),
    admin.organizationMembership.create({ data: { organizationId: orgB, userId: userB, role: 'OWNER' } }),
    admin.organizationMembership.create({ data: { organizationId: orgA, userId: userC, role: 'ADMIN' } }),
  ]);
  await admin.organizationMembership.updateMany({
    where: { userId: userC },
    data: { deletedAt: new Date() },
  });
});

afterAll(async () => {
  await admin.organizationMembership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await admin.user.deleteMany({ where: { id: { in: [userA, userB, userC] } } });
  await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  const { prisma } = await import('../../infrastructure/database/prisma');
  await Promise.all([admin.$disconnect(), runtime.$disconnect(), prisma.$disconnect()]);
});

describe('GET /session (integración)', () => {
  const app = createApp({ auth: { runtimeClient: runtime } });

  it('el cliente de la API no es superuser ni tiene BYPASSRLS', async () => {
    const [role] = await runtime.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('con el club propio responde 200 y no incluye el email', async () => {
    const response = await request(app)
      .get('/session')
      .set('Authorization', `Bearer ${sign(authA)}`)
      .set('X-Organization-Id', orgA);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ organizationId: orgA, role: 'OWNER' });
    expect(JSON.stringify(response.body)).not.toContain('@');
    expect(JSON.stringify(response.body)).not.toContain('Club');
  });

  it('rechaza el club ajeno y una membresía dada de baja', async () => {
    const foreign = await request(app)
      .get('/session')
      .set('Authorization', `Bearer ${sign(authA)}`)
      .set('X-Organization-Id', orgB);
    const removed = await request(app)
      .get('/session')
      .set('Authorization', `Bearer ${sign(authC)}`)
      .set('X-Organization-Id', orgA);

    expect(foreign.status).toBe(403);
    expect(foreign.body).toEqual({ error: 'Sin acceso' });
    expect(removed.status).toBe(403);
    expect(JSON.stringify(foreign.body)).not.toContain('Club');
    expect(JSON.stringify(removed.body)).not.toContain('@');
  });

  it('con el rol de migraciones responde 503 y no devuelve datos del club', async () => {
    const privileged = createApp({ auth: { runtimeClient: admin } });
    const response = await request(privileged)
      .get('/session')
      .set('Authorization', `Bearer ${sign(authA)}`)
      .set('X-Organization-Id', orgA);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Auth no configurada' });
    expect(JSON.stringify(response.body)).not.toContain(orgA);
    expect(JSON.stringify(response.body)).not.toContain('Club');
  });
});
