import { type Request, type Response, Router } from 'express';
import type { BillingPeriod } from '@prisma/client';
import { withTenant } from '../../infrastructure/database/tenant';
import { badRequest } from '../../shared/errors/http-error';
import { asyncHandler } from '../../shared/http/async-handler';
import { getTenant, requireTenant } from '../../shared/http/tenant-context';
import { formatDateOnly, parseDateOnly } from '../../shared/utils/dates';
import { centsToNumber, parseAmountCents } from '../../shared/utils/money';
import { parseUuid } from '../../shared/validation/ids';
import {
  type ChargeToIssue,
  createBillingPeriod,
  issueBillingPeriod,
  listBillingPeriods,
} from './billing-periods.service';
import { type AccountStatement, getAccountStatement } from './ledger.service';

const MAX_CHARGES_PER_ISSUE = 5000;

function body(req: Request): Record<string, unknown> {
  return typeof req.body === 'object' && req.body !== null ? req.body : {};
}

function parsePeriodInput(raw: Record<string, unknown>) {
  const { year, month } = raw;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw badRequest('year tiene que ser un año entre 2000 y 2100');
  }
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) {
    throw badRequest('month tiene que ser un número de mes entre 1 y 12');
  }
  return { year, month, dueDate: parseDateOnly(raw.dueDate, 'dueDate') };
}

function parseChargesToIssue(raw: unknown, period: { year: number; month: number } | null): ChargeToIssue[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CHARGES_PER_ISSUE) {
    throw badRequest(`charges tiene que ser una lista de 1 a ${MAX_CHARGES_PER_ISSUE} cuotas`);
  }
  const seen = new Set<string>();
  return raw.map((item: unknown, index: number) => {
    const entry = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
    const accountId = parseUuid(entry.accountId, `charges[${index}].accountId`);
    if (seen.has(accountId)) {
      throw badRequest(`La cuenta ${accountId} aparece dos veces`);
    }
    seen.add(accountId);
    const concept =
      typeof entry.concept === 'string' && entry.concept.trim() !== ''
        ? entry.concept.trim()
        : `Cuota ${period ? `${String(period.month).padStart(2, '0')}/${period.year}` : ''}`.trim();
    return {
      accountId,
      amountCents: parseAmountCents(entry.amountCents, `charges[${index}].amountCents`),
      concept,
    };
  });
}

export function serializeBillingPeriod(p: BillingPeriod) {
  return {
    id: p.id,
    year: p.year,
    month: p.month,
    dueDate: formatDateOnly(p.dueDate),
    status: p.status,
    issuedAt: p.issuedAt?.toISOString() ?? null,
  };
}

export function serializeStatement(s: AccountStatement) {
  return {
    accountId: s.accountId,
    currency: s.currency,
    status: s.status,
    totals: Object.fromEntries(
      Object.entries(s.totals).map(([key, value]) => [key, centsToNumber(value)]),
    ),
    charges: s.charges.map((c) => ({
      ...c,
      amountCents: centsToNumber(c.amountCents),
      paidCents: centsToNumber(c.paidCents),
      outstandingCents: centsToNumber(c.outstandingCents),
    })),
    payments: s.payments.map((p) => ({
      ...p,
      amountCents: centsToNumber(p.amountCents),
      appliedCents: centsToNumber(p.appliedCents),
      paidAt: p.paidAt.toISOString(),
    })),
  };
}

/**
 * Rutas de cobranza. Todas exigen tenant (`requireTenant`) y corren dentro de
 * `withTenant`, así que RLS aplica en cada query.
 */
export function createFinanceRouter(): Router {
  const router = Router();
  router.use(requireTenant);

  router.get(
    '/billing-periods',
    asyncHandler(async (req: Request, res: Response) => {
      const { organizationId } = getTenant(req);
      const periods = await withTenant(organizationId, (tx) => listBillingPeriods(tx, organizationId));
      res.json({ billingPeriods: periods.map(serializeBillingPeriod) });
    }),
  );

  router.post(
    '/billing-periods',
    asyncHandler(async (req: Request, res: Response) => {
      const { organizationId } = getTenant(req);
      const input = parsePeriodInput(body(req));
      const period = await withTenant(organizationId, (tx) =>
        createBillingPeriod(tx, organizationId, input),
      );
      res.status(201).json(serializeBillingPeriod(period));
    }),
  );

  router.post(
    '/billing-periods/:periodId/issue',
    asyncHandler(async (req: Request, res: Response) => {
      const { organizationId, userId } = getTenant(req);
      const periodId = parseUuid(req.params.periodId, 'periodId');
      const result = await withTenant(organizationId, async (tx) => {
        const period = await tx.billingPeriod.findFirst({
          where: { id: periodId, organizationId },
          select: { year: true, month: true },
        });
        const items = parseChargesToIssue(body(req).charges, period);
        return issueBillingPeriod(tx, organizationId, periodId, items, userId);
      });
      res.json({
        billingPeriod: serializeBillingPeriod(result.period),
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        allocatedCount: result.allocatedCount,
      });
    }),
  );

  router.get(
    '/accounts/:accountId/statement',
    asyncHandler(async (req: Request, res: Response) => {
      const { organizationId } = getTenant(req);
      const accountId = parseUuid(req.params.accountId, 'accountId');
      const statement = await withTenant(organizationId, (tx) =>
        getAccountStatement(tx, organizationId, accountId),
      );
      res.json(serializeStatement(statement));
    }),
  );

  return router;
}
