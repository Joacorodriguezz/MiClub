import { badRequest } from '../errors/http-error';

/** Zona horaria de los clubes (regla 7 del CLAUDE.md). */
export const ORGANIZATION_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Valida una fecha `YYYY-MM-DD` (vencimientos) y la devuelve como `Date` a las
 * 00:00 UTC, que es como Prisma guarda una columna `DATE` sin correrla de día.
 */
export function parseDateOnly(value: unknown, field: string): Date {
  const match = typeof value === 'string' ? DATE_ONLY.exec(value) : null;
  if (!match) {
    throw badRequest(`${field} tiene que ser una fecha con formato YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw badRequest(`${field} no es una fecha válida`);
  }
  return date;
}

/** Formatea una columna `DATE` como `YYYY-MM-DD`. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Fecha de hoy en Argentina, `YYYY-MM-DD`, para decidir si algo está vencido. */
export function todayInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ORGANIZATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
