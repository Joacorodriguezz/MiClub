import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { buildCorsOptions, validateProductionEnv } from './cors';

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe('validateProductionEnv', () => {
  it('exige CORS_ORIGIN en producción', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGIN;

    expect(validateProductionEnv()).toMatch(/CORS_ORIGIN/);
  });

  it('no exige CORS_ORIGIN fuera de producción', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGIN;

    expect(validateProductionEnv()).toBeNull();
  });
});

describe('buildCorsOptions', () => {
  it('acepta varios orígenes separados por coma', () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173,https://app.vercel.app';
    delete process.env.CORS_ORIGIN_PATTERN;

    const options = buildCorsOptions();
    expect(options.origin).toEqual(['http://localhost:5173', 'https://app.vercel.app']);
  });

  it('combina lista exacta con patrón para previews', async () => {
    process.env.CORS_ORIGIN = 'https://miclub.vercel.app';
    process.env.CORS_ORIGIN_PATTERN = '^https://[\\w-]+\\.vercel\\.app$';

    const options = buildCorsOptions();
    expect(typeof options.origin).toBe('function');

    const preview = 'https://miclub-git-feat-x.vercel.app';
    await new Promise<void>((resolve, reject) => {
      const originFn = options.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean | string) => void,
      ) => void;
      originFn(preview, (err, allow) => {
        try {
          expect(err).toBeNull();
          expect(allow).toBe(preview);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
});

describe('CORS antes de express.json()', () => {
  it('incluye headers CORS en respuesta a JSON mal formado', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    delete process.env.CORS_ORIGIN_PATTERN;

    const app = createApp();
    const response = await request(app)
      .post('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json')
      .send('{ invalid');

    expect(response.status).toBe(400);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
