import { describe, expect, it } from 'vitest';
import { formatDateOnly, parseDateOnly, todayInArgentina } from './dates';

describe('fechas', () => {
  it('parsea y formatea un DATE sin correrlo de día', () => {
    expect(formatDateOnly(parseDateOnly('2026-11-10', 'dueDate'))).toBe('2026-11-10');
  });

  it('rechaza formatos y fechas inexistentes', () => {
    expect(() => parseDateOnly('10/11/2026', 'dueDate')).toThrow(/YYYY-MM-DD/);
    expect(() => parseDateOnly('2026-02-30', 'dueDate')).toThrow(/válida/);
  });

  it('hoy se calcula en hora de Argentina, no en UTC', () => {
    // 02:00 UTC del 1/12 todavía es 30/11 a las 23:00 en Buenos Aires.
    expect(todayInArgentina(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11-30');
    expect(todayInArgentina(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12-01');
  });
});
