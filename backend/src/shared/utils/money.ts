import { badRequest } from '../errors/http-error';

/**
 * Montos de dinero: siempre enteros en centavos (`bigint`), nunca float.
 * En JSON viajan como número entero de centavos.
 */
export const CURRENCY = 'ARS';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Valida un monto recibido por la API: entero positivo de centavos. */
export function parseAmountCents(value: unknown, field = 'amountCents'): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw badRequest(`${field} tiene que ser un número entero positivo, en centavos`);
  }
  return BigInt(value);
}

/** Convierte centavos a número para JSON. Falla si se pierde precisión. */
export function centsToNumber(value: bigint): number {
  if (value > MAX_SAFE || value < -MAX_SAFE) {
    throw new Error('Monto fuera del rango representable en JSON');
  }
  return Number(value);
}
