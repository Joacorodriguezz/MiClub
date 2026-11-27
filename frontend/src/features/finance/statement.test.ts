import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStatement, pesos } from './statement.ts';

const account = '00000000-0000-4000-8000-000000000001';
const statement = {
  accountId: account, currency: 'ARS', status: 'IN_ARREARS',
  totals: { chargedCents: 100, paidCents: 5, appliedCents: 5, debtCents: 95, creditCents: 0, balanceCents: 95, overdueCents: 95 },
  charges: [{ id: 'cargo', concept: 'Cuota', amountCents: 100, paidCents: 5, outstandingCents: 95, dueDate: '2026-10-15', overdue: true }],
  payments: [{ id: 'pago', method: 'CASH', paidAt: '2026-11-01T02:00:00.000Z', amountCents: 5, appliedCents: 5 }],
};

test('acepta cargos parcialmente pagados y cuentas sin movimientos', () => {
  assert.equal(isStatement(statement, account), true);
  assert.equal(isStatement({ ...statement, charges: [], payments: [] }, account), true);
});

test('rechaza otra cuenta, otra moneda, importes inválidos o movimientos incompletos', () => {
  assert.equal(isStatement(statement, 'otra'), false);
  assert.equal(isStatement({ ...statement, currency: 'USD' }, account), false);
  assert.equal(isStatement({ ...statement, totals: { ...statement.totals, debtCents: 1.5 } }, account), false);
  assert.equal(isStatement({ ...statement, payments: [{}] }, account), false);
});

test('conserva los centavos al mostrar montos grandes', () => {
  assert.equal(pesos(1), '$ 0,01');
  assert.equal(pesos(Number.MAX_SAFE_INTEGER), '$ 90.071.992.547.409,91');
});
