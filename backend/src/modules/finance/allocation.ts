/**
 * Reparto de pagos sobre cargos, sin acceso a la base (testeable en aislamiento).
 *
 * Regla: FIFO. Los pagos más viejos cancelan primero los cargos más viejos.
 * Las dos listas llegan ya ordenadas por antigüedad.
 */
export interface AvailablePayment {
  id: string;
  availableCents: bigint;
}

export interface OpenCharge {
  id: string;
  outstandingCents: bigint;
}

export interface Allocation {
  paymentId: string;
  chargeId: string;
  amountCents: bigint;
}

export function allocateFifo(payments: AvailablePayment[], charges: OpenCharge[]): Allocation[] {
  const available = payments.map((p) => p.availableCents);
  const outstanding = charges.map((c) => c.outstandingCents);
  const allocations: Allocation[] = [];

  let p = 0;
  let c = 0;
  while (p < payments.length && c < charges.length) {
    if (available[p] <= 0n) {
      p += 1;
      continue;
    }
    if (outstanding[c] <= 0n) {
      c += 1;
      continue;
    }

    const amountCents = available[p] < outstanding[c] ? available[p] : outstanding[c];
    allocations.push({ paymentId: payments[p].id, chargeId: charges[c].id, amountCents });
    available[p] -= amountCents;
    outstanding[c] -= amountCents;
  }

  return allocations;
}

/** Estado de un cargo derivado de lo aplicado. Nunca se guarda. */
export type ChargeStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export function chargeStatus(amountCents: bigint, paidCents: bigint): ChargeStatus {
  if (paidCents <= 0n) return 'PENDING';
  if (paidCents < amountCents) return 'PARTIAL';
  return 'PAID';
}
