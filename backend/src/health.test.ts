import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('GET /health', () => {
  it('responde 200 con status ok, uptime y timestamp', async () => {
    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});
