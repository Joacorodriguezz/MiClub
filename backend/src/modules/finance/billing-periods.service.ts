import type { BillingPeriod } from '@prisma/client';
import type { TenantTransaction } from '../../infrastructure/database/tenant';
import { conflict, isUniqueViolation, notFound } from '../../shared/errors/http-error';
import { allocateOpenBalance } from './ledger.service';

export interface NewBillingPeriod {
  year: number;
  month: number;
  dueDate: Date;
}

export async function createBillingPeriod(
  tx: TenantTransaction,
  organizationId: string,
  input: NewBillingPeriod,
): Promise<BillingPeriod> {
  try {
    return await tx.billingPeriod.create({ data: { organizationId, ...input } });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(`Ya existe el período ${input.month}/${input.year}`);
    }
    throw err;
  }
}

export function listBillingPeriods(
  tx: TenantTransaction,
  organizationId: string,
): Promise<BillingPeriod[]> {
  return tx.billingPeriod.findMany({
    where: { organizationId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

/** Cargo de cuota a emitir para una cuenta. */
export interface ChargeToIssue {
  accountId: string;
  amountCents: bigint;
  concept: string;
}

export interface IssueResult {
  period: BillingPeriod;
  createdCount: number;
  skippedCount: number;
  allocatedCount: number;
}

/**
 * Emite las cuotas de un período. Idempotente: un cargo por cuenta, período y
 * tipo (índice único). Reintentar no duplica: los existentes se saltean, y se
 * puede volver a llamar para sumar cuentas que faltaron.
 *
 * El monto de cada cuota lo decide quien llama. Cuando exista el módulo de
 * padrón, va a salir de la categoría y el precio vigente de cada cuenta.
 *
 * Al terminar, aplica el saldo a favor que tuvieran las cuentas.
 */
export async function issueBillingPeriod(
  tx: TenantTransaction,
  organizationId: string,
  periodId: string,
  items: ChargeToIssue[],
  issuedByUserId: string | null,
): Promise<IssueResult> {
  const period = await tx.billingPeriod.findFirst({ where: { id: periodId, organizationId } });
  if (!period) {
    throw notFound('Período inexistente');
  }
  if (period.status === 'CLOSED') {
    throw conflict('El período está cerrado: no se pueden emitir cargos');
  }

  const { count } = await tx.charge.createMany({
    data: items.map((item) => ({
      organizationId,
      accountId: item.accountId,
      billingPeriodId: period.id,
      type: 'FEE' as const,
      concept: item.concept,
      amountCents: item.amountCents,
      dueDate: period.dueDate,
      createdByUserId: issuedByUserId,
    })),
    skipDuplicates: true,
  });

  const issuedPeriod =
    period.status === 'OPEN'
      ? await tx.billingPeriod.update({
          where: { id: period.id },
          data: { status: 'ISSUED', issuedAt: new Date(), issuedByUserId },
        })
      : period;

  const accountsWithPayments = await tx.payment.findMany({
    where: { organizationId, accountId: { in: items.map((i) => i.accountId) } },
    select: { accountId: true },
    distinct: ['accountId'],
  });

  let allocatedCount = 0;
  for (const { accountId } of accountsWithPayments) {
    const allocations = await allocateOpenBalance(tx, organizationId, accountId);
    allocatedCount += allocations.length;
  }

  return {
    period: issuedPeriod,
    createdCount: count,
    skippedCount: items.length - count,
    allocatedCount,
  };
}
