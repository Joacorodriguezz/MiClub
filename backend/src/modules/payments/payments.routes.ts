import { type Request, type Response, Router } from 'express';
import { badRequest } from '../../shared/errors/http-error';
import { asyncHandler } from '../../shared/http/async-handler';
import type { SessionAuth } from '../auth/router';
import { currentUserId, getTenant, tenantGuard } from '../../shared/http/tenant-context';
import { centsToNumber, parseAmountCents } from '../../shared/utils/money';
import { parseUuid } from '../../shared/validation/ids';
import { type NewManualPayment, recordManualPayment } from './payments.service';

const MANUAL_METHODS = ['CASH', 'TRANSFER', 'OTHER'] as const;
// Fecha y hora ISO 8601 con zona explícita (Z u offset), para no adivinar el día.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) {
    throw badRequest(`${field} tiene que ser un texto de hasta ${max} caracteres`);
  }
  return value.trim() || null;
}

function parseManualPayment(accountId: string, raw: Record<string, unknown>): NewManualPayment {
  const method = raw.method;
  if (typeof method !== 'string' || !(MANUAL_METHODS as readonly string[]).includes(method)) {
    throw badRequest(`method tiene que ser uno de: ${MANUAL_METHODS.join(', ')}`);
  }

  let paidAt = new Date();
  if (raw.paidAt !== undefined) {
    if (typeof raw.paidAt !== 'string' || !ISO_WITH_OFFSET.test(raw.paidAt)) {
      throw badRequest('paidAt tiene que ser una fecha y hora ISO 8601 con zona horaria');
    }
    paidAt = new Date(raw.paidAt);
    if (Number.isNaN(paidAt.getTime())) {
      throw badRequest('paidAt no es una fecha válida');
    }
  }

  return {
    accountId,
    amountCents: parseAmountCents(raw.amountCents),
    method: method as NewManualPayment['method'],
    paidAt,
    externalReference: optionalText(raw.externalReference, 'externalReference', 200),
    notes: optionalText(raw.notes, 'notes', 1000),
  };
}

export function createPaymentsRouter(auth?: SessionAuth): Router {
  const router = Router();
  const requireTenant = tenantGuard(auth);

  router.post(
    '/accounts/:accountId/payments',
    requireTenant,
    asyncHandler(async (req: Request, res: Response) => {
      const { organizationId, authUserId, run } = getTenant(req);
      const accountId = parseUuid(req.params.accountId, 'accountId');
      const raw = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const input = parseManualPayment(accountId, raw);
      const key = req.get('Idempotency-Key');
      if (key !== undefined) input.requestId = parseUuid(key, 'Idempotency-Key');
      if (!input.requestId && !input.externalReference) {
        throw badRequest('Un pago sin referencia requiere Idempotency-Key (UUID)');
      }

      const { payment, allocations, replayed } = await run(async (tx) =>
        recordManualPayment(tx, organizationId, input, await currentUserId(tx, authUserId)),
      );

      // Un reintento con la misma Idempotency-Key devuelve el pago ya creado.
      res.status(replayed ? 200 : 201).json({
        payment: {
          id: payment.id,
          accountId: payment.accountId,
          amountCents: centsToNumber(payment.amountCents),
          currency: payment.currency,
          method: payment.method,
          paidAt: payment.paidAt.toISOString(),
          externalReference: payment.externalReference,
        },
        allocations: allocations.map((a) => ({
          chargeId: a.chargeId,
          amountCents: centsToNumber(a.amountCents),
        })),
      });
    }),
  );

  return router;
}
