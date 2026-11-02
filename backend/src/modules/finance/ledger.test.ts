import { describe, expect, it } from 'vitest';
import { allocatePaymentOldestFirst, deriveBalanceCents } from './ledger';

describe('allocatePaymentOldestFirst', () => {
  it('aplica un pago parcial al cargo más antiguo', () => {
    const result = allocatePaymentOldestFirst(5000, [
      { id: 'march', dueDate: '2026-03-10', amountCents: 10000, appliedCents: 0 },
      { id: 'april', dueDate: '2026-04-10', amountCents: 10000, appliedCents: 0 },
    ]);

    expect(result).toEqual({
      applications: [{ chargeId: 'march', amountCents: 5000 }],
      unappliedCents: 0,
    });
  });

  it('cubre los cargos más viejos antes de continuar con el siguiente', () => {
    const result = allocatePaymentOldestFirst(17000, [
      { id: 'april', dueDate: '2026-04-10', amountCents: 10000, appliedCents: 0 },
      { id: 'march', dueDate: '2026-03-10', amountCents: 10000, appliedCents: 3000 },
    ]);

    expect(result).toEqual({
      applications: [
        { chargeId: 'march', amountCents: 7000 },
        { chargeId: 'april', amountCents: 10000 },
      ],
      unappliedCents: 0,
    });
  });

  it('deja el excedente como saldo a favor y no crea un cargo negativo', () => {
    const result = allocatePaymentOldestFirst(15000, [
      { id: 'march', dueDate: '2026-03-10', amountCents: 10000, appliedCents: 0 },
    ]);

    expect(result).toEqual({
      applications: [{ chargeId: 'march', amountCents: 10000 }],
      unappliedCents: 5000,
    });
  });

  it('omite cargos anulados y rechaza importes que romperían el ledger', () => {
    expect(
      allocatePaymentOldestFirst(10000, [
        { id: 'voided', dueDate: '2026-01-10', amountCents: 10000, appliedCents: 0, voided: true },
      ]),
    ).toEqual({ applications: [], unappliedCents: 10000 });

    expect(() =>
      allocatePaymentOldestFirst(100, [
        { id: 'broken', dueDate: '2026-01-10', amountCents: 100, appliedCents: 101 },
      ]),
    ).toThrow(/mayores a su importe/);
  });
});

describe('deriveBalanceCents', () => {
  it('deriva el saldo de cargos menos aplicaciones sin guardarlo como estado mutable', () => {
    expect(deriveBalanceCents(25000, 18000)).toBe(7000);
    expect(deriveBalanceCents(10000, 15000)).toBe(-5000);
  });
});
