import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('GET /ready', () => {
  it('responde 200 cuando la sonda resuelve', async () => {
    const app = createApp({ readinessProbe: async () => undefined });
    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('responde 503 sin filtrar el error cuando la base no responde', async () => {
    const app = createApp({
      readinessProbe: async () => {
        throw new Error('postgresql://user:secret@db.example:5432/postgres connection refused');
      },
    });
    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('postgresql');
  });
});
