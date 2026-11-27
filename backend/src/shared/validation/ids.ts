import { badRequest } from '../errors/http-error';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida un UUID y lo normaliza en minúsculas (forma canónica de Postgres). */
export function parseUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw badRequest(`${field} tiene que ser un UUID`);
  }
  return value.toLowerCase();
}
