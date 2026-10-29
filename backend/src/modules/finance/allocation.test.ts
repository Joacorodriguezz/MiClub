import { describe, expect, it } from 'vitest';
import { allocateFifo, chargeStatus } from './allocation';

describe('allocateFifo', () => {
  it('un pago exacto cancela un cargo', () => {
    expect(allocateFifo([{ id: 'p1', availableCents: 1500n }], [{ id: 'c1', outstandingCents: 1500n }]))
      .toEqual([{ paymentId: 'p1', chargeId: 'c1', amountCents: 1500n }]);
  });

  it('cancela primero los cargos más viejos', () => {
    const result = allocateFifo(
      [{ id: 'p1', availableCents: 2000n }],
      [
        { id: 'marzo', outstandingCents: 1500n },
        { id: 'abril', outstandingCents: 1500n },
      ],
    );
    expect(result).toEqual([
      { paymentId: 'p1', chargeId: 'marzo', amountCents: 1500n },
      { paymentId: 'p1', chargeId: 'abril', amountCents: 500n },
    ]);
  });

  it('usa varios pagos para un mismo cargo', () => {
    const result = allocateFifo(
      [
        { id: 'p1', availableCents: 400n },
        { id: 'p2', availableCents: 700n },
      ],
      [{ id: 'c1', outstandingCents: 1000n }],
    );
    expect(result).toEqual([
      { paymentId: 'p1', chargeId: 'c1', amountCents: 400n },
      { paymentId: 'p2', chargeId: 'c1', amountCents: 600n },
    ]);
  });

  it('saltea pagos ya usados y cargos ya pagados', () => {
    const result = allocateFifo(
      [
        { id: 'usado', availableCents: 0n },
        { id: 'p2', availableCents: 300n },
      ],
      [
        { id: 'pagado', outstandingCents: 0n },
        { id: 'c2', outstandingCents: 1000n },
      ],
    );
    expect(result).toEqual([{ paymentId: 'p2', chargeId: 'c2', amountCents: 300n }]);
  });

  it('sin deuda o sin dinero no aplica nada', () => {
    expect(allocateFifo([], [{ id: 'c1', outstandingCents: 100n }])).toEqual([]);
    expect(allocateFifo([{ id: 'p1', availableCents: 100n }], [])).toEqual([]);
  });

  it('nunca aplica más que lo disponible ni más que lo adeudado', () => {
    const payments = [
      { id: 'p1', availableCents: 999n },
      { id: 'p2', availableCents: 1n },
      { id: 'p3', availableCents: 5000n },
    ];
    const charges = [
      { id: 'c1', outstandingCents: 1000n },
      { id: 'c2', outstandingCents: 2500n },
    ];
    const result = allocateFifo(payments, charges);
    for (const p of payments) {
      const used = result.filter((a) => a.paymentId === p.id).reduce((s, a) => s + a.amountCents, 0n);
      expect(used <= p.availableCents).toBe(true);
    }
    for (const c of charges) {
      const paid = result.filter((a) => a.chargeId === c.id).reduce((s, a) => s + a.amountCents, 0n);
      expect(paid).toBe(c.outstandingCents);
    }
  });
});

describe('chargeStatus', () => {
  it('deriva el estado de lo aplicado', () => {
    expect(chargeStatus(1000n, 0n)).toBe('PENDING');
    expect(chargeStatus(1000n, 1n)).toBe('PARTIAL');
    expect(chargeStatus(1000n, 1000n)).toBe('PAID');
  });
});
