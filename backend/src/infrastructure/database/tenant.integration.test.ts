import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from './tenant';

/**
 * Test de aislamiento multi-tenant contra un Postgres real con las migraciones
 * aplicadas. Es bloqueante en CI: si falla, un club puede ver datos de otro.
 *
 * El seed y la limpieza usan la conexión directa (superusuario en CI); las
 * aserciones pasan por `withTenant`, que es el camino que usa la API.
 *
 * `connection_limit=1` fuerza a que todas las queries usen la misma conexión,
 * para probar que el contexto de tenant no sobrevive a la transacción.
 */
function singleConnectionUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.searchParams.set('connection_limit', '1');
  return url.toString();
}

const db = new PrismaClient({ datasourceUrl: singleConnectionUrl() });

const suffix = randomUUID().slice(0, 8);
let orgA: string;
let orgB: string;
let userA: string;
let userB: string;

beforeAll(async () => {
  const [a, b] = await Promise.all([
    db.organization.create({ data: { name: 'Club A', slug: `club-a-${suffix}` } }),
    db.organization.create({ data: { name: 'Club B', slug: `club-b-${suffix}` } }),
  ]);
  orgA = a.id;
  orgB = b.id;

  const [ua, ub] = await Promise.all([
    db.user.create({ data: { authUserId: randomUUID(), email: `a-${suffix}@test.local` } }),
    db.user.create({ data: { authUserId: randomUUID(), email: `b-${suffix}@test.local` } }),
  ]);
  userA = ua.id;
  userB = ub.id;

  await db.organizationMembership.createMany({
    data: [
      { organizationId: orgA, userId: userA, role: 'OWNER' },
      { organizationId: orgB, userId: userB, role: 'OWNER' },
    ],
  });
});

afterAll(async () => {
  // Limpieza del test con la conexión directa; la API no puede borrar.
  await db.organizationMembership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
  await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await db.$disconnect();
});

describe('aislamiento multi-tenant (RLS)', () => {
  it('un club solo ve su propia organización', async () => {
    const orgs = await withTenant(orgA, (tx) => tx.organization.findMany(), db);

    expect(orgs.map((o) => o.id)).toEqual([orgA]);
  });

  it('con el contexto del club A, las membresías del club B devuelven cero filas', async () => {
    const rows = await withTenant(
      orgA,
      (tx) => tx.organizationMembership.findMany({ where: { organizationId: orgB } }),
      db,
    );

    expect(rows).toEqual([]);
  });

  it('un club solo ve a los usuarios que son miembros suyos', async () => {
    const users = await withTenant(
      orgA,
      (tx) => tx.user.findMany({ where: { id: { in: [userA, userB] } } }),
      db,
    );

    expect(users.map((u) => u.id)).toEqual([userA]);
  });

  it('sin tenant fijado no se ve ninguna fila (falla cerrado)', async () => {
    const rows = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE miclub_app');
      return tx.organizationMembership.findMany({
        where: { organizationId: { in: [orgA, orgB] } },
      });
    });

    expect(rows).toEqual([]);
  });

  it('el club A no puede crear una membresía en el club B', async () => {
    await expect(
      withTenant(
        orgA,
        (tx) =>
          tx.organizationMembership.create({
            data: { organizationId: orgB, userId: userA, role: 'ADMIN' },
          }),
        db,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('el club A no puede modificar la organización del club B', async () => {
    const result = await withTenant(
      orgA,
      (tx) => tx.organization.updateMany({ where: { id: orgB }, data: { name: 'Hackeado' } }),
      db,
    );

    expect(result.count).toBe(0);
    const orgBNow = await db.organization.findUniqueOrThrow({ where: { id: orgB } });
    expect(orgBNow.name).toBe('Club B');
  });

  it('el rol de runtime no puede borrar: las bajas son lógicas', async () => {
    await expect(
      withTenant(
        orgA,
        (tx) => tx.organizationMembership.deleteMany({ where: { organizationId: orgA } }),
        db,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('el tenant y el rol no sobreviven a la transacción (seguro con pooling)', async () => {
    await withTenant(orgA, (tx) => tx.organization.findMany(), db);

    const [after] = await db.$queryRaw<{ tenant: string | null; role: string }[]>`
      SELECT NULLIF(current_setting('app.organization_id', true), '') AS tenant,
             current_user::text AS role
    `;

    expect(after.tenant).toBeNull();
    expect(after.role).not.toBe('miclub_app');
  });

  it('rechaza un organizationId que no es UUID', async () => {
    await expect(withTenant('club-a', (tx) => tx.organization.findMany(), db)).rejects.toThrow(
      /UUID/,
    );
  });
});
