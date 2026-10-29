import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { type TenantTransaction, withTenant } from '../../infrastructure/database/tenant';
import { errorHandler } from '../../shared/http/error-handler';
import { parseDateOnly } from '../../shared/utils/dates';
import { createPaymentsRouter } from '../payments/payments.routes';
import { recordManualPayment } from '../payments/payments.service';
import {
  createBillingPeriod,
  issueBillingPeriod,
} from './billing-periods.service';
import { createFinanceRouter } from './finance.routes';
import { getAccountStatement } from './ledger.service';

/**
 * Ledger de cobranza contra un Postgres real con las migraciones aplicadas.
 *
 * Recorre el flujo del Checkpoint 2 (período → emisión → pagos → saldo) y prueba
 * las reglas que hace cumplir la base: idempotencia de la emisión, inmutabilidad
 * de los registros de dinero, tope de las aplicaciones y aislamiento por club.
 *
 * Los tests de un `describe` corren en orden y comparten el estado del club A.
 */
const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const suffix = randomUUID().slice(0, 8);
const account1 = randomUUID();
const account2 = randomUUID();
let orgA: string;
let orgB: string;
let userA: string;

const asA = <T>(fn: (tx: TenantTransaction) => Promise<T>) => withTenant(orgA, fn, db);
const asB = <T>(fn: (tx: TenantTransaction) => Promise<T>) => withTenant(orgB, fn, db);

const cashPayment = (accountId: string, amountCents: bigint, externalReference: string | null = null) => ({
  accountId,
  amountCents,
  method: 'CASH' as const,
  paidAt: new Date('2026-11-03T15:00:00-03:00'),
  externalReference,
  notes: null,
});

beforeAll(async () => {
  const [a, b] = await Promise.all([
    db.organization.create({ data: { name: 'Club A', slug: `ledger-a-${suffix}` } }),
    db.organization.create({ data: { name: 'Club B', slug: `ledger-b-${suffix}` } }),
  ]);
  orgA = a.id;
  orgB = b.id;

  const user = await db.user.create({
    data: { authUserId: randomUUID(), email: `tesorero-${suffix}@test.local` },
  });
  userA = user.id;
  await db.organizationMembership.create({
    data: { organizationId: orgA, userId: userA, role: 'OWNER' },
  });
});

afterAll(async () => {
  // Los registros de dinero no se pueden borrar ni siquiera como dueño de la
  // tabla: para limpiar, el test desactiva los triggers en su transacción.
  const orgs = [orgA, orgB];
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
    await tx.paymentAllocation.deleteMany({ where: { organizationId: { in: orgs } } });
    await tx.payment.deleteMany({ where: { organizationId: { in: orgs } } });
    await tx.charge.deleteMany({ where: { organizationId: { in: orgs } } });
    await tx.billingPeriod.deleteMany({ where: { organizationId: { in: orgs } } });
    await tx.organizationMembership.deleteMany({ where: { organizationId: { in: orgs } } });
    await tx.user.deleteMany({ where: { id: userA } });
    await tx.organization.deleteMany({ where: { id: { in: orgs } } });
  });
  await db.$disconnect();
});

describe('ledger de cobranza', () => {
  let novemberId: string;
  let novemberCharge1: string;
  let firstPaymentId: string;

  it('emite las cuotas del período y lo marca como emitido', async () => {
    const period = await asA((tx) =>
      createBillingPeriod(tx, orgA, {
        year: 2026,
        month: 11,
        dueDate: parseDateOnly('2026-11-10', 'dueDate'),
      }),
    );
    novemberId = period.id;

    const result = await asA((tx) =>
      issueBillingPeriod(
        tx,
        orgA,
        novemberId,
        [
          { accountId: account1, amountCents: 1_500_000n, concept: 'Cuota 11/2026' },
          { accountId: account2, amountCents: 900_000n, concept: 'Cuota 11/2026' },
        ],
        userA,
      ),
    );

    expect(result.createdCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.period.status).toBe('ISSUED');
    expect(result.period.issuedByUserId).toBe(userA);

    const statement = await asA((tx) => getAccountStatement(tx, orgA, account1, '2026-11-05'));
    expect(statement.charges).toHaveLength(1);
    expect(statement.charges[0]).toMatchObject({
      amountCents: 1_500_000n,
      dueDate: '2026-11-10',
      status: 'PENDING',
      period: { year: 2026, month: 11 },
    });
    novemberCharge1 = statement.charges[0].id;
  });

  it('reemitir el período no duplica cargos', async () => {
    const before = await asA((tx) => tx.billingPeriod.findUniqueOrThrow({ where: { id: novemberId } }));

    const result = await asA((tx) =>
      issueBillingPeriod(
        tx,
        orgA,
        novemberId,
        [
          { accountId: account1, amountCents: 1_500_000n, concept: 'Cuota 11/2026' },
          { accountId: account2, amountCents: 900_000n, concept: 'Cuota 11/2026' },
        ],
        userA,
      ),
    );

    expect(result.createdCount).toBe(0);
    expect(result.skippedCount).toBe(2);
    const charges = await asA((tx) => tx.charge.count({ where: { billingPeriodId: novemberId } }));
    expect(charges).toBe(2);
    expect(result.period.issuedAt).toEqual(before.issuedAt);
  });

  it('un pago parcial deja el cargo parcial y la deuda derivada', async () => {
    const { payment, allocations } = await asA((tx) =>
      recordManualPayment(tx, orgA, cashPayment(account1, 1_000_000n), userA),
    );
    firstPaymentId = payment.id;

    expect(allocations).toEqual([
      { paymentId: payment.id, chargeId: novemberCharge1, amountCents: 1_000_000n },
    ]);

    const statement = await asA((tx) => getAccountStatement(tx, orgA, account1, '2026-11-05'));
    expect(statement.charges[0].status).toBe('PARTIAL');
    expect(statement.totals).toMatchObject({
      chargedCents: 1_500_000n,
      appliedCents: 1_000_000n,
      debtCents: 500_000n,
      creditCents: 0n,
      balanceCents: 500_000n,
    });
    expect(statement.status).toBe('UP_TO_DATE');
  });

  it('lo que sobra de un pago queda como saldo a favor', async () => {
    const { allocations } = await asA((tx) =>
      recordManualPayment(
        tx,
        orgA,
        { ...cashPayment(account1, 700_000n, 'TRF-0001'), method: 'TRANSFER' },
        userA,
      ),
    );
    expect(allocations.map((a) => a.amountCents)).toEqual([500_000n]);

    const statement = await asA((tx) => getAccountStatement(tx, orgA, account1, '2026-11-20'));
    expect(statement.charges[0].status).toBe('PAID');
    expect(statement.totals).toMatchObject({
      paidCents: 1_700_000n,
      debtCents: 0n,
      creditCents: 200_000n,
      balanceCents: -200_000n,
      overdueCents: 0n,
    });
    expect(statement.status).toBe('UP_TO_DATE');
  });

  it('una cuenta con cuota vencida e impaga está morosa', async () => {
    const before = await asA((tx) => getAccountStatement(tx, orgA, account2, '2026-11-10'));
    expect(before.status).toBe('UP_TO_DATE');

    const after = await asA((tx) => getAccountStatement(tx, orgA, account2, '2026-11-11'));
    expect(after.status).toBe('IN_ARREARS');
    expect(after.totals.overdueCents).toBe(900_000n);
    expect(after.charges[0].overdue).toBe(true);
  });

  it('el saldo a favor se aplica a la cuota siguiente al emitirla', async () => {
    const december = await asA((tx) =>
      createBillingPeriod(tx, orgA, {
        year: 2026,
        month: 12,
        dueDate: parseDateOnly('2026-12-10', 'dueDate'),
      }),
    );

    const result = await asA((tx) =>
      issueBillingPeriod(
        tx,
        orgA,
        december.id,
        [{ accountId: account1, amountCents: 1_500_000n, concept: 'Cuota 12/2026' }],
        userA,
      ),
    );
    expect(result.allocatedCount).toBe(1);

    const statement = await asA((tx) => getAccountStatement(tx, orgA, account1, '2026-12-01'));
    const decemberCharge = statement.charges.find((c) => c.period.month === 12);
    expect(decemberCharge).toMatchObject({ paidCents: 200_000n, status: 'PARTIAL' });
    expect(statement.totals).toMatchObject({ debtCents: 1_300_000n, creditCents: 0n });
  });

  it('no se puede crear dos veces el mismo período', async () => {
    await expect(
      asA((tx) =>
        createBillingPeriod(tx, orgA, {
          year: 2026,
          month: 11,
          dueDate: parseDateOnly('2026-11-15', 'dueDate'),
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('una referencia de pago repetida se rechaza y no registra nada', async () => {
    await expect(
      asA((tx) => recordManualPayment(tx, orgA, cashPayment(account1, 100n, 'TRF-0001'), userA)),
    ).rejects.toMatchObject({ status: 409 });

    const payments = await asA((tx) => tx.payment.count({ where: { accountId: account1 } }));
    expect(payments).toBe(2);
  });

  it('el rol de runtime no puede modificar ni borrar registros de dinero', async () => {
    await expect(
      asA((tx) => tx.charge.updateMany({ where: { id: novemberCharge1 }, data: { amountCents: 1n } })),
    ).rejects.toThrow(/permission denied/);

    await expect(
      asA((tx) => tx.payment.deleteMany({ where: { id: firstPaymentId } })),
    ).rejects.toThrow(/permission denied/);
  });

  it('ni el dueño de las tablas puede modificar registros de dinero', async () => {
    await expect(
      db.charge.updateMany({ where: { id: novemberCharge1 }, data: { amountCents: 1n } }),
    ).rejects.toThrow(/inmutables/);

    await expect(db.paymentAllocation.deleteMany({ where: { paymentId: firstPaymentId } })).rejects.toThrow(
      /inmutables/,
    );

    const charge = await db.charge.findUniqueOrThrow({ where: { id: novemberCharge1 } });
    expect(charge.amountCents).toBe(1_500_000n);
  });

  it('la base rechaza aplicar más de lo que tiene el pago', async () => {
    const december = await asA((tx) =>
      tx.charge.findFirstOrThrow({ where: { accountId: account1, billingPeriod: { month: 12 } } }),
    );

    // El primer pago ya se usó entero en noviembre.
    await expect(
      asA((tx) =>
        tx.paymentAllocation.create({
          data: { organizationId: orgA, paymentId: firstPaymentId, chargeId: december.id, amountCents: 1n },
        }),
      ),
    ).rejects.toThrow(/supera el saldo disponible del pago/);
  });

  it('la base rechaza aplicar un pago a un cargo de otra cuenta', async () => {
    const { payment } = await asA((tx) =>
      recordManualPayment(tx, orgA, cashPayment(account2, 100_000n), userA),
    );
    const charge1 = await asA((tx) => tx.charge.findUniqueOrThrow({ where: { id: novemberCharge1 } }));

    await expect(
      asA((tx) =>
        tx.paymentAllocation.create({
          data: { organizationId: orgA, paymentId: payment.id, chargeId: charge1.id, amountCents: 1n },
        }),
      ),
    ).rejects.toThrow(/misma cuenta/);
  });

  it('un período emitido no vuelve a abierto', async () => {
    await expect(
      asA((tx) => tx.billingPeriod.update({ where: { id: novemberId }, data: { status: 'OPEN' } })),
    ).rejects.toThrow(/no puede volver/);
  });
});

describe('aislamiento multi-tenant del ledger (RLS)', () => {
  it('con el contexto del club B, el ledger del club A devuelve cero filas', async () => {
    const [periods, charges, payments, allocations] = await asB((tx) =>
      Promise.all([
        tx.billingPeriod.findMany({ where: { organizationId: orgA } }),
        tx.charge.findMany({ where: { organizationId: orgA } }),
        tx.payment.findMany({ where: { organizationId: orgA } }),
        tx.paymentAllocation.findMany({ where: { organizationId: orgA } }),
      ]),
    );

    expect(periods).toEqual([]);
    expect(charges).toEqual([]);
    expect(payments).toEqual([]);
    expect(allocations).toEqual([]);
  });

  it('la cuenta corriente de una cuenta del club A está vacía para el club B', async () => {
    const statement = await asB((tx) => getAccountStatement(tx, orgB, account1, '2026-12-01'));
    expect(statement.charges).toEqual([]);
    expect(statement.totals.balanceCents).toBe(0n);
  });

  it('el club B no puede emitir cargos en un período del club A', async () => {
    const periodA = await asA((tx) => tx.billingPeriod.findFirstOrThrow({ where: { month: 11 } }));

    await expect(
      asB((tx) =>
        issueBillingPeriod(tx, orgB, periodA.id, [{ accountId: account1, amountCents: 1n, concept: 'x' }], null),
      ),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      asB((tx) =>
        tx.charge.create({
          data: {
            organizationId: orgA,
            accountId: account1,
            billingPeriodId: periodA.id,
            type: 'LATE_FEE',
            concept: 'Recargo trucho',
            amountCents: 1n,
            dueDate: new Date('2026-11-10T00:00:00Z'),
          },
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('el club B no puede aplicar un pago suyo a un cargo del club A', async () => {
    const { payment } = await asB((tx) =>
      recordManualPayment(tx, orgB, cashPayment(account1, 100_000n), null),
    );
    const chargeA = await asA((tx) => tx.charge.findFirstOrThrow({ where: { accountId: account2 } }));

    await expect(
      asB((tx) =>
        tx.paymentAllocation.create({
          data: { organizationId: orgB, paymentId: payment.id, chargeId: chargeA.id, amountCents: 1n },
        }),
      ),
    ).rejects.toThrow(/inexistente/);
  });
});

describe('API de cobranza', () => {
  it('sin usuario autenticado responde 401 (falla cerrado)', async () => {
    const res = await request(createApp()).get('/api/v1/billing-periods');
    expect(res.status).toBe(401);
  });

  it('recorre período, emisión, pago y cuenta corriente por HTTP', async () => {
    // Simula el middleware de auth, que todavía no existe.
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.tenant = { organizationId: orgA, userId: userA };
      next();
    });
    app.use('/api/v1', createFinanceRouter());
    app.use('/api/v1', createPaymentsRouter());
    app.use(errorHandler);

    const account = randomUUID();

    const created = await request(app)
      .post('/api/v1/billing-periods')
      .send({ year: 2027, month: 1, dueDate: '2027-01-10' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ year: 2027, month: 1, dueDate: '2027-01-10', status: 'OPEN' });

    const issued = await request(app)
      .post(`/api/v1/billing-periods/${created.body.id}/issue`)
      .send({ charges: [{ accountId: account, amountCents: 1_200_000 }] });
    expect(issued.status).toBe(200);
    expect(issued.body).toMatchObject({ createdCount: 1, billingPeriod: { status: 'ISSUED' } });

    const invalid = await request(app)
      .post(`/api/v1/accounts/${account}/payments`)
      .send({ amountCents: 15.5, method: 'CASH' });
    expect(invalid.status).toBe(400);

    const paid = await request(app)
      .post(`/api/v1/accounts/${account}/payments`)
      .send({ amountCents: 1_200_000, method: 'TRANSFER', externalReference: `TRF-${suffix}` });
    expect(paid.status).toBe(201);
    expect(paid.body.allocations).toEqual([
      { chargeId: expect.any(String), amountCents: 1_200_000 },
    ]);

    const repeated = await request(app)
      .post(`/api/v1/accounts/${account}/payments`)
      .send({ amountCents: 1_200_000, method: 'TRANSFER', externalReference: `TRF-${suffix}` });
    expect(repeated.status).toBe(409);

    const statement = await request(app).get(`/api/v1/accounts/${account}/statement`);
    expect(statement.status).toBe(200);
    expect(statement.body).toMatchObject({
      accountId: account,
      currency: 'ARS',
      status: 'UP_TO_DATE',
      totals: { chargedCents: 1_200_000, debtCents: 0, balanceCents: 0 },
      charges: [{ concept: 'Cuota 01/2027', status: 'PAID', dueDate: '2027-01-10' }],
    });
  });
});
