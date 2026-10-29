import { describe, expect, it } from 'vitest';
import { centsToNumber, parseAmountCents } from './money';

describe('montos en centavos', () => {
  it('acepta enteros positivos', () => {
    expect(parseAmountCents(1500000)).toBe(1500000n);
  });

  it('rechaza decimales, negativos, cero y texto', () => {
    for (const value of [15.5, -100, 0, '1500', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parseAmountCents(value)).toThrow(/centavos/);
    }
  });

  it('no pierde precisión al serializar', () => {
    expect(centsToNumber(123n)).toBe(123);
    expect(() => centsToNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow();
  });
});
