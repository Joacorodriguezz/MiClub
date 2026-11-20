import type { Payment, PaymentMethod } from '@prisma/client';
import type { TenantTransaction } from '../../infrastructure/database/tenant';
import { conflict, isUniqueViolation, notFound } from '../../shared/errors/http-error';
import type { Allocation } from '../finance/allocation';
import { allocateOpenBalance, lockAccount } from '../finance/ledger.service';

export interface NewManualPayment {
  requestId?: string;
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
      throw conflict('Ya se registro un pago con esta clave de operacion o referencia');
    }
    throw err;
  }

  const allocations = await allocateOpenBalance(tx, organizationId, input.accountId);
  return { payment, allocations };
}

export async function reverseManualPayment(
  tx: TenantTransaction,
  organizationId: string,
  accountId: string,
  paymentId: string,
  userId: string,
  reason: string,
) {
  await lockAccount(tx, accountId);
  const payment = await tx.payment.findFirst({
    where: { organizationId, accountId, id: paymentId },
    include: { reversal: true },
  });
  if (!payment) throw notFound('Pago inexistente');
  if (payment.method === 'MERCADO_PAGO') throw conflict('Se requiere un pago manual');
  if (payment.reversal) return payment.reversal;

  const reversal = await tx.paymentReversal.create({
    data: { organizationId, paymentId, userId, reason },
  });
  await allocateOpenBalance(tx, organizationId, accountId);
  return reversal;
}
