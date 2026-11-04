import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app';

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
});
