import type { PaymentMethod } from '@prisma/client';
import type { TenantTransaction } from '../../infrastructure/database/tenant';
import { formatDateOnly, todayInArgentina } from '../../shared/utils/dates';
import { CURRENCY } from '../../shared/utils/money';
import { allocateFifo, type Allocation, chargeStatus, type ChargeStatus } from './allocation';

/**
 * Ledger de una cuenta: aplicación de pagos y cuenta corriente.
 *
 * Toda función recibe la transacción de `withTenant`: RLS ya limita al club, y
 * además cada query filtra por `organizationId` (regla 3 del CLAUDE.md).
 */

const effectiveAllocations = { where: { payment: { reversal: null } }, select: { amountCents: true } };

const sum = (values: bigint[]) => values.reduce((acc, v) => acc + v, 0n);

/**
 * Serializa las operaciones de dinero sobre una cuenta hasta el fin de la
 * transacción. Usa la misma clave que el trigger `app_check_payment_allocation`.
 */
export async function lockAccount(tx: TenantTransaction, accountId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`ledger:${accountId}`}, 0))`;
}

/**
 * Aplica todo el dinero sin aplicar de la cuenta a sus cargos abiertos, en
 * orden FIFO. Es idempotente: si no hay saldo a favor o no hay deuda, no hace
 * nada. Se llama después de registrar un pago y después de emitir cargos.
 */
export async function allocateOpenBalance(
  tx: TenantTransaction,
  organizationId: string,
  accountId: string,
): Promise<Allocation[]> {
  await lockAccount(tx, accountId);

  const [charges, payments] = await Promise.all([
    tx.charge.findMany({
      where: { organizationId, accountId },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, amountCents: true, allocations: effectiveAllocations },
    }),
    tx.payment.findMany({
      where: { organizationId, accountId, reversal: null },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, amountCents: true, allocations: effectiveAllocations },
    }),
  ]);

  const allocations = allocateFifo(
    payments.map((p) => ({
      id: p.id,
      availableCents: p.amountCents - sum(p.allocations.map((a) => a.amountCents)),
    })),
    charges.map((c) => ({
      id: c.id,
      outstandingCents: c.amountCents - sum(c.allocations.map((a) => a.amountCents)),
    })),
  );

  if (allocations.length > 0) {
    await tx.paymentAllocation.createMany({
      data: allocations.map((a) => ({ organizationId, ...a })),
    });
  }

  return allocations;
}

export type AccountStatus = 'UP_TO_DATE' | 'IN_ARREARS';

export interface StatementCharge {
  id: string;
  period: { year: number; month: number };
  type: string;
  concept: string;
  amountCents: bigint;
  paidCents: bigint;
  outstandingCents: bigint;
  dueDate: string;
  status: ChargeStatus;
  overdue: boolean;
}

export interface StatementPayment {
  id: string;
  amountCents: bigint;
  appliedCents: bigint;
  method: PaymentMethod;
  paidAt: Date;
  externalReference: string | null;
  reversal: { userId: string; reason: string; createdAt: Date } | null;
}

export interface AccountStatement {
  accountId: string;
  currency: string;
  /** Al día o moroso: derivado, nunca editable (regla 5). */
  status: AccountStatus;
  totals: {
    chargedCents: bigint;
    paidCents: bigint;
    appliedCents: bigint;
    /** Deuda = cargos − aplicaciones de pago (regla 1). */
    debtCents: bigint;
    /** Saldo a favor: dinero recibido que todavía no cancela ningún cargo. */
    creditCents: bigint;
    /** Deuda − saldo a favor. Positivo = la cuenta debe. */
    balanceCents: bigint;
    overdueCents: bigint;
  };
  charges: StatementCharge[];
  payments: StatementPayment[];
}

/** Cuenta corriente de una cuenta, calculada desde el ledger. */
export async function getAccountStatement(
  tx: TenantTransaction,
  organizationId: string,
  accountId: string,
  today: string = todayInArgentina(),
): Promise<AccountStatement> {
  await lockAccount(tx, accountId);
  const [charges, payments] = await Promise.all([
    tx.charge.findMany({
      where: { organizationId, accountId },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: {
        billingPeriod: { select: { year: true, month: true } },
        allocations: effectiveAllocations,
      },
    }),
    tx.payment.findMany({
      where: { organizationId, accountId },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: { allocations: effectiveAllocations, reversal: { select: { userId: true, reason: true, createdAt: true } } },
    }),
  ]);

  const statementCharges: StatementCharge[] = charges.map((c) => {
    const paidCents = sum(c.allocations.map((a) => a.amountCents));
    const outstandingCents = c.amountCents - paidCents;
    const dueDate = formatDateOnly(c.dueDate);
    return {
      id: c.id,
      period: c.billingPeriod,
      type: c.type,
      concept: c.concept,
      amountCents: c.amountCents,
      paidCents,
      outstandingCents,
      dueDate,
      status: chargeStatus(c.amountCents, paidCents),
      overdue: outstandingCents > 0n && dueDate < today,
    };
  });

  const statementPayments: StatementPayment[] = payments.map((p) => ({
    id: p.id,
    amountCents: p.amountCents,
    appliedCents: sum(p.allocations.map((a) => a.amountCents)),
    method: p.method,
    paidAt: p.paidAt,
    externalReference: p.externalReference,
    reversal: p.reversal,
  }));

  const chargedCents = sum(statementCharges.map((c) => c.amountCents));
  const appliedCents = sum(statementCharges.map((c) => c.paidCents));
  const paidCents = sum(statementPayments.filter((p) => !p.reversal).map((p) => p.amountCents));
  const debtCents = chargedCents - appliedCents;
  const creditCents = paidCents - appliedCents;
  const overdueCents = sum(
    statementCharges.filter((c) => c.overdue).map((c) => c.outstandingCents),
  );

  return {
    accountId,
    currency: CURRENCY,
    status: overdueCents > 0n ? 'IN_ARREARS' : 'UP_TO_DATE',
    totals: {
      chargedCents,
      paidCents,
      appliedCents,
      debtCents,
      creditCents,
      balanceCents: debtCents - creditCents,
      overdueCents,
    },
    charges: statementCharges,
    payments: statementPayments,
  };
}
