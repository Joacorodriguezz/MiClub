import http from 'node:http';
import type { ErrorEvent } from '@sentry/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureError, initSentry, moduleFromPath, readSentryDsn, scrubSentryEvent } from './sentry';

const CLUB_ID = '22222222-2222-4222-8222-222222222222';

describe('readSentryDsn', () => {
  it('rechaza vacío, http y el placeholder', () => {
    expect(readSentryDsn(undefined)).toBeNull();
    expect(readSentryDsn('  ')).toBeNull();
    expect(readSentryDsn('http://public@o0.ingest.sentry.io/1')).toBeNull();
    expect(readSentryDsn('https://YOUR_DSN@o0.ingest.sentry.io/0')).toBeNull();
    expect(readSentryDsn('https://public@o0.ingest.sentry.io/1?token=secret')).toBeNull();
  });

  it('acepta la forma de un DSN https sin abrirlo', () => {
    expect(readSentryDsn(' https://publickey@o0.ingest.sentry.io/1 ')).toBe(
      'https://publickey@o0.ingest.sentry.io/1',
    );
  });
});

describe('moduleFromPath', () => {
  it('agrupa salud y sesión, y usa el primer segmento para el resto', () => {
    expect(moduleFromPath('/health')).toBe('platform');
    expect(moduleFromPath('/ready')).toBe('platform');
    expect(moduleFromPath('/session')).toBe('auth');
    expect(moduleFromPath('/members/1')).toBe('members');
  });
});

describe('scrubSentryEvent', () => {
  it('borra usuario, request y datos personales del mensaje', () => {
    const event = {
      type: undefined,
      message: 'falló admin@test.local Bearer eyJ.secreto',
      user: { email: 'admin@test.local', username: 'Ada' },
      request: { headers: { Authorization: 'Bearer eyJ.secreto' }, data: { dni: '30111222' } },
      extra: { nombre: 'Ada' },
      breadcrumbs: [{ message: 'admin@test.local', data: { password: 'local-test-password' } }],
      server_name: 'api.internal',
      exception: {
        values: [
          {
            type: 'Error',
            value: 'postgresql://user:secret@db.example:5432/postgres admin@test.local',
          },
        ],
      },
      tags: { module: 'platform', club_id: CLUB_ID },
    } as ErrorEvent;

    const line = JSON.stringify(scrubSentryEvent(event));

    expect(line).not.toContain('admin@test.local');
    expect(line).not.toContain('eyJ');
    expect(line).not.toContain('secret');
    expect(line).not.toContain('30111222');
    expect(line).not.toContain('Ada');
    expect(line).not.toContain('local-test-password');
    expect(line).not.toContain('postgresql');
    expect(line).not.toContain('api.internal');
    expect(line).toContain(CLUB_ID);
    expect(line).toContain('[redactado]');
  });
});

describe('initSentry', () => {
  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });

  it('no inicia ni abre la red si falta el DSN', () => {
    const request = vi.spyOn(http, 'request');
    delete process.env.SENTRY_DSN;

    expect(initSentry()).toBe(false);
    captureError(new Error('postgresql://user:secret@db.example/postgres admin@test.local'), {
      module: 'platform',
      clubId: CLUB_ID,
    });

    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });

  it('no inicia con el placeholder', () => {
    process.env.SENTRY_DSN = 'https://YOUR_DSN@o0.ingest.sentry.io/0';
    expect(initSentry()).toBe(false);
  });
});
