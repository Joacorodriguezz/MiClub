import type { Payment, PaymentMethod } from '@prisma/client';
import type { TenantTransaction } from '../../infrastructure/database/tenant';
import { conflict, isUniqueViolation } from '../../shared/errors/http-error';
import type { Allocation } from '../finance/allocation';
import { allocateOpenBalance, lockAccount } from '../finance/ledger.service';

export interface NewManualPayment {
  accountId: string;
  amountCents: bigint;
  method: Exclude<PaymentMethod, 'MERCADO_PAGO'>;
  paidAt: Date;
  externalReference: string | null;
  notes: string | null;
}

export interface RecordedPayment {
  payment: Payment;
  allocations: Allocation[];
}

/**
 * Registra un pago manual (efectivo, transferencia) y lo aplica a los cargos
 * abiertos de la cuenta, de los más viejos a los más nuevos. Lo que sobra queda
 * como saldo a favor y se aplica cuando se emitan cargos nuevos.
 *
 * Los pagos de Mercado Pago entran por el webhook (módulo de pagos online), no acá.
 */
export async function recordManualPayment(
  tx: TenantTransaction,
  organizationId: string,
  input: NewManualPayment,
  recordedByUserId: string | null,
): Promise<RecordedPayment> {
  await lockAccount(tx, input.accountId);

  let payment: Payment;
  try {
    payment = await tx.payment.create({
      data: { organizationId, ...input, recordedByUserId },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(`Ya hay un pago registrado con la referencia ${input.externalReference}`);
    }
    throw err;
  }

  const allocations = await allocateOpenBalance(tx, organizationId, input.accountId);
  return { payment, allocations };
}
