import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';

const CLUB_ID = '22222222-2222-4222-8222-222222222222';

describe('request logger', () => {
  const lines: string[] = [];
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    lines.length = 0;
  });

  function captureStdout(): void {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    restore = () => spy.mockRestore();
  }

  function lineFor(requestId: string | undefined): Record<string, unknown> {
    const parsed = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((event) => event.request_id === requestId && event.msg === 'request');
    if (!parsed) {
      throw new Error('no se escribió el log del request');
    }
    return parsed;
  }

  it('loguea /health con club_id null y el request id de la respuesta', async () => {
    captureStdout();
    const response = await request(createApp()).get('/health');
    const event = lineFor(response.headers['x-request-id']);

    expect(response.status).toBe(200);
    expect(event.club_id).toBeNull();
    expect(event.method).toBe('GET');
    expect(event.path).toBe('/health');
    expect(event.status).toBe(200);
    expect(typeof event.duration_ms).toBe('number');
    expect(JSON.stringify(event)).not.toContain('@');
  });

  it('loguea el club solo si el header es un UUID, y no escribe el token', async () => {
    captureStdout();
    const app = createApp();

    const emailHeader = await request(app).get('/session').set('X-Organization-Id', 'admin@test.local');
    const clubHeader = await request(app)
      .get('/session')
      .set('Authorization', 'Bearer secreto-token')
      .set('X-Organization-Id', CLUB_ID);

    const emailLog = lineFor(emailHeader.headers['x-request-id']);
    const clubLog = lineFor(clubHeader.headers['x-request-id']);
    const serialized = lines.join('');

    expect(emailLog.club_id).toBeNull();
    expect(clubLog.club_id).toBe(CLUB_ID);
    expect(serialized).not.toContain('admin@test.local');
    expect(serialized).not.toContain('secreto-token');
    expect(serialized).not.toContain('Bearer');
  });

  it('un fallo de /ready no escribe el error de la base', async () => {
    captureStdout();
    const response = await request(
      createApp({
        readinessProbe: async () => {
          throw new Error('postgresql://user:secret@db.example:5432/postgres admin@test.local');
        },
      }),
    ).get('/ready');

    const serialized = lines.join('');
    expect(response.status).toBe(503);
    expect(serialized).toContain('ready: la base no respondió');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('postgresql');
    expect(serialized).not.toContain('admin@test.local');
  });
});
