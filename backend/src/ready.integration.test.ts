import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { checkRuntimeDatabase } from './infrastructure/database/readiness';
import { createRuntimeClient } from './infrastructure/database/runtimeClient';

/**
 * Readiness contra Postgres real. Usa el cliente de proceso (`DATABASE_URL`),
 * el mismo que atiende `GET /ready` en el servidor. No inyecta una sonda:
 * si el handler deja de ejecutar `SELECT 1`, este test falla.
 *
 * En CI `DATABASE_URL` es el rol de migraciones. `SELECT 1` no lee datos de
 * tenant; el rol de runtime se exige en el test de aislamiento, no acá.
 */
describe('GET /ready (integración)', () => {
  afterAll(async () => {
    const { prisma } = await import('./infrastructure/database/prisma');
    await prisma.$disconnect();
  });

  it('responde 200 cuando SELECT 1 contra DATABASE_URL funciona', async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL para el test de GET /ready');
    }

    const app = createApp();
    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('con la sonda de runtime responde 200 con miclub_runtime y 503 con un superuser', async () => {
    const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
    const adminUrl = process.env.DATABASE_URL;
    if (!runtimeUrl || !adminUrl) {
      throw new Error('Faltan RUNTIME_DATABASE_URL o DATABASE_URL para el test de GET /ready');
    }

    const runtime = createRuntimeClient(runtimeUrl);
    const admin = createRuntimeClient(adminUrl);
    try {
      const ok = await request(createApp({ readinessProbe: () => checkRuntimeDatabase(runtime) })).get('/ready');
      expect(ok.status).toBe(200);

      // En CI DATABASE_URL es postgres (superuser): la sonda de runtime tiene que rechazarlo.
      const rejected = await request(createApp({ readinessProbe: () => checkRuntimeDatabase(admin) })).get('/ready');
      expect(rejected.status).toBe(503);
    } finally {
      await runtime.$disconnect();
      await admin.$disconnect();
    }
  });
});
