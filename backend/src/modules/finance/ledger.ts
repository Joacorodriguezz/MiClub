/**
 * Reglas puras del ledger. La persistencia vive fuera de este módulo: estos
 * helpers no crean ni modifican asientos, para que el saldo siga siendo una
 * proyección reproducible de cargos y aplicaciones.
 */

export type ChargeForAllocation = {
  id: string;
  /** Fecha de vencimiento ISO (YYYY-MM-DD). */
  dueDate: string;
  /** Importe original del cargo, en centavos. */
  amountCents: number;
  /** Centavos ya aplicados a este cargo. */
  appliedCents: number;
  /** Un cargo anulado no admite nuevas aplicaciones. */
  voided?: boolean;
};

export type PaymentApplication = {
  chargeId: string;
  amountCents: number;
};

export type AllocationResult = {
  applications: PaymentApplication[];
  /** Saldo a favor: pago recibido que no tuvo cargos abiertos que cubrir. */
  unappliedCents: number;
};

function assertCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} debe ser un entero no negativo en centavos`);
  }
}

function assertIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${field} debe ser una fecha ISO válida (YYYY-MM-DD)`);
  }
}

/**
 * Distribuye un pago manual contra los cargos abiertos, del vencimiento más
 * antiguo al más reciente. Para vencimientos iguales usa el id como desempate
 * estable; el llamador debe pasar el id persistido del cargo.
 */
export function allocatePaymentOldestFirst(
  paymentCents: number,
  charges: readonly ChargeForAllocation[],
): AllocationResult {
  assertCents(paymentCents, 'paymentCents');

  const openCharges = charges
    .map((charge) => {
      assertCents(charge.amountCents, `amountCents de ${charge.id}`);
      assertCents(charge.appliedCents, `appliedCents de ${charge.id}`);
      assertIsoDate(charge.dueDate, `dueDate de ${charge.id}`);
      if (charge.appliedCents > charge.amountCents) {
        throw new Error(`El cargo ${charge.id} tiene aplicaciones mayores a su importe`);
      }
      return charge;
    })
    .filter((charge) => !charge.voided && charge.appliedCents < charge.amountCents)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

  let remaining = paymentCents;
  const applications: PaymentApplication[] = [];

  for (const charge of openCharges) {
    if (remaining === 0) break;

    const allocation = Math.min(remaining, charge.amountCents - charge.appliedCents);
    applications.push({ chargeId: charge.id, amountCents: allocation });
    remaining -= allocation;
  }

  return { applications, unappliedCents: remaining };
}

/** Saldo de la cuenta, siempre derivado de cargos menos aplicaciones. */
export function deriveBalanceCents(chargesCents: number, applicationsCents: number): number {
  assertCents(chargesCents, 'chargesCents');
  assertCents(applicationsCents, 'applicationsCents');
  return chargesCents - applicationsCents;
}
