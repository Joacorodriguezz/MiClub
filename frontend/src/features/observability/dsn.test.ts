import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSentryDsn } from './dsn.ts';
import { scrubSentryEvent } from './scrub.ts';

describe('readSentryDsn', () => {
  it('rechaza vacío, http y el placeholder', () => {
    assert.equal(readSentryDsn(undefined), null);
    assert.equal(readSentryDsn('  '), null);
    assert.equal(readSentryDsn('http://public@o0.ingest.sentry.io/1'), null);
    assert.equal(readSentryDsn('https://YOUR_DSN@o0.ingest.sentry.io/0'), null);
  });

  it('acepta la forma de un DSN https sin abrirlo', () => {
    assert.equal(
      readSentryDsn(' https://publickey@o0.ingest.sentry.io/1 '),
      'https://publickey@o0.ingest.sentry.io/1',
    );
  });
});

describe('scrubSentryEvent', () => {
  it('borra usuario, request y el email del mensaje', () => {
    const line = JSON.stringify(
      scrubSentryEvent({
        message: 'falló admin@test.local',
        user: { email: 'admin@test.local', username: 'Ada' },
        request: { data: { dni: '30111222', password: 'local-test-password' } },
        breadcrumbs: [{ message: 'Bearer eyJ.secreto' }],
        exception: { values: [{ value: 'postgresql://user:secret@db.example/postgres' }] },
      }),
    );

    assert.equal(line.includes('admin@test.local'), false);
    assert.equal(line.includes('Ada'), false);
    assert.equal(line.includes('30111222'), false);
    assert.equal(line.includes('local-test-password'), false);
    assert.equal(line.includes('eyJ'), false);
    assert.equal(line.includes('postgresql'), false);
    assert.equal(line.includes('secret'), false);
    assert.equal(line.includes('[redactado]'), true);
  });
});
