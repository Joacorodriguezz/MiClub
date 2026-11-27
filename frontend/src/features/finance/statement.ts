export type Statement = {
  accountId: string;
  currency: 'ARS';
  status: 'UP_TO_DATE' | 'IN_ARREARS';
  totals: {
    chargedCents: number;
    paidCents: number;
    appliedCents: number;
    debtCents: number;
    creditCents: number;
    balanceCents: number;
    overdueCents: number;
  };
  charges: {
    id: string;
    concept: string;
    dueDate: string;
    amountCents: number;
    paidCents: number;
    outstandingCents: number;
    overdue: boolean;
  }[];
  payments: { id: string; paidAt: string; method: keyof typeof methods; amountCents: number; appliedCents: number }[];
};

export const methods = { CASH: 'Efectivo', TRANSFER: 'Transferencia', MERCADO_PAGO: 'Mercado Pago', OTHER: 'Otro' };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cents(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

// balanceCents = deuda − saldo a favor: puede ser negativo.
function signedCents(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function isStatement(value: unknown, accountId: string): value is Statement {
  if (!record(value) || value.accountId !== accountId || value.currency !== 'ARS' ||
    (value.status !== 'UP_TO_DATE' && value.status !== 'IN_ARREARS') || !record(value.totals)) return false;
  const totals = value.totals;
  return cents(totals.chargedCents) && cents(totals.paidCents) && cents(totals.appliedCents) &&
    cents(totals.debtCents) && cents(totals.creditCents) && signedCents(totals.balanceCents) &&
    cents(totals.overdueCents) &&
    Array.isArray(value.charges) && value.charges.every(c => record(c) && typeof c.id === 'string' &&
      typeof c.concept === 'string' && typeof c.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.dueDate) &&
      cents(c.amountCents) && cents(c.paidCents) && cents(c.outstandingCents) && typeof c.overdue === 'boolean') &&
    Array.isArray(value.payments) && value.payments.every(p => record(p) && typeof p.id === 'string' &&
      typeof p.method === 'string' && Object.hasOwn(methods, p.method) && typeof p.paidAt === 'string' &&
      Number.isFinite(Date.parse(p.paidAt)) && cents(p.amountCents) && cents(p.appliedCents));
}

export function pesos(amount: number) {
  const value = BigInt(amount);
  return '$ ' + (value / 100n).toLocaleString('es-AR') + ',' + String(value % 100n).padStart(2, '0');
}
