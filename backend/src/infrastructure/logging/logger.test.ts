import { describe, expect, it } from 'vitest';
import { clubIdFromHeader, formatLogLine } from './logger';

const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-04T15:00:00.000Z');

describe('formatLogLine', () => {
  it('incluye club_id en la línea y lo deja null si no hay club', () => {
    const withClub = JSON.parse(formatLogLine({ level: 'info', msg: 'request', club_id: CLUB_ID }, NOW));
    const withoutClub = JSON.parse(formatLogLine({ level: 'info', msg: 'escuchando' }, NOW));

    expect(withClub.club_id).toBe(CLUB_ID);
    expect(withoutClub.club_id).toBeNull();
    expect(withoutClub.request_id).toBeNull();
  });

  it('no copia email, nombre, dni ni token aunque vengan en el objeto', () => {
    const event = {
      level: 'info' as const,
      msg: 'request',
      club_id: CLUB_ID,
      email: 'admin@test.local',
      name: 'Ada Lovelace',
      nombre: 'Ada Lovelace',
      dni: '30111222',
      authorization: 'Bearer eyJhbGci.secreto',
      password: 'local-test-password',
      access_token: 'token-value',
    };

    const line = formatLogLine(event, NOW);
    const parsed = JSON.parse(line) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual(['club_id', 'level', 'msg', 'request_id', 'time']);
    expect(line).not.toContain('admin@test.local');
    expect(line).not.toContain('Ada');
    expect(line).not.toContain('30111222');
    expect(line).not.toContain('eyJ');
    expect(line).not.toContain('local-test-password');
    expect(line).not.toContain('token-value');
  });

  it('redacta un email o un Bearer que se hayan colado en el mensaje y corta la query', () => {
    const line = formatLogLine(
      {
        level: 'error',
        msg: 'falló admin@test.local Bearer abc.def.ghi',
        path: '/session?access_token=token-value',
        status: 500,
      },
      NOW,
    );

    expect(line).not.toContain('admin@test.local');
    expect(line).not.toContain('abc.def.ghi');
    expect(line).not.toContain('token-value');
    expect(line).toContain('[redactado]');
    expect(JSON.parse(line).path).toBe('/session');
  });
});

describe('clubIdFromHeader', () => {
  it('acepta un UUID y descarta un email o un texto', () => {
    expect(clubIdFromHeader(`  ${CLUB_ID}  `)).toBe(CLUB_ID);
    expect(clubIdFromHeader('admin@test.local')).toBeNull();
    expect(clubIdFromHeader('30111222')).toBeNull();
    expect(clubIdFromHeader(undefined)).toBeNull();
  });
});
