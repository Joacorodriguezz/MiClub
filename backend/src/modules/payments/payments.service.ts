import type { Payment, PaymentMethod } from '@prisma/client';
import type { TenantTransaction } from '../../infrastructure/database/tenant';
import { conflict, isUniqueViolation } from '../../shared/errors/http-error';
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
  /** true si la Idempotency-Key ya tenía un pago: se devuelve ese, sin registrar otro. */
  replayed: boolean;
}

function samePayment(existing: Payment, input: NewManualPayment): boolean {
  return (
    existing.accountId === input.accountId &&
    existing.amountCents === input.amountCents &&
    existing.method === input.method &&
    existing.externalReference === input.externalReference
  );
}

/**
 * Registra un pago manual (efectivo, transferencia) y lo aplica a los cargos
 * abiertos de la cuenta, de los más viejos a los más nuevos. Lo que sobra queda
 * como saldo a favor y se aplica cuando se emitan cargos nuevos.
 *
 * Con `requestId` (Idempotency-Key) es idempotente: un reintento con la misma
 * clave y los mismos datos devuelve el pago ya registrado y sus aplicaciones.
 * La misma clave con otros datos es un conflicto.
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

  // El lock de la cuenta serializa los reintentos concurrentes: el segundo ve
  // el pago del primero ya commiteado. Si la clave se usó en otra cuenta, el
  // índice único la rechaza abajo.
  if (input.requestId) {
    const existing = await tx.payment.findFirst({
      where: { organizationId, requestId: input.requestId },
      include: { allocations: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) {
      const { allocations, ...payment } = existing;
      if (!samePayment(payment, input)) {
        throw conflict('Esta clave de operacion ya se uso para un pago distinto');
      }
      return {
        payment,
        allocations: allocations.map((a) => ({
          paymentId: a.paymentId,
          chargeId: a.chargeId,
          amountCents: a.amountCents,
        })),
        replayed: true,
      };
    }
  }

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
  return { payment, allocations, replayed: false };
}
