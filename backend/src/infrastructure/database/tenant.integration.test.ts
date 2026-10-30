import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from './tenant';

/**
 * Test de aislamiento multi-tenant contra un Postgres real con las migraciones
 * aplicadas. Es bloqueante en CI: si falla, un club puede ver datos de otro.
 *
 * Usa dos conexiones, como en producción:
 * - `DATABASE_URL`: el rol que corre las migraciones. Acá solo siembra y limpia.
 * - `RUNTIME_DATABASE_URL`: el rol con el que se conecta la API, LOGIN y sin
 *   SUPERUSER ni BYPASSRLS, miembro de `miclub_app`. Todas las aserciones pasan
 *   por esta conexión.
 *
 * `connection_limit=1` en la conexión de runtime fuerza a que todas sus queries
 * usen la misma conexión, para probar que el contexto de tenant no sobrevive a
 * la transacción.
 */
function requiredUrl(name: string): URL {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} para el test de aislamiento`);
  }
  return new URL(value);
}

const runtimeUrl = requiredUrl('RUNTIME_DATABASE_URL');
runtimeUrl.searchParams.set('connection_limit', '1');

const admin = new PrismaClient({ datasourceUrl: requiredUrl('DATABASE_URL').toString() });
const app = new PrismaClient({ datasourceUrl: runtimeUrl.toString() });

const suffix = randomUUID().slice(0, 8);
let orgA: string;
let orgB: string;
let userA: string;
let userB: string;
let membershipA: string;

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.organization.create({ data: { name: 'Club A', slug: `club-a-${suffix}` } }),
    admin.organization.create({ data: { name: 'Club B', slug: `club-b-${suffix}` } }),
  ]);
  orgA = a.id;
  orgB = b.id;

  const [ua, ub] = await Promise.all([
    admin.user.create({ data: { authUserId: randomUUID(), email: `a-${suffix}@test.local` } }),
    admin.user.create({ data: { authUserId: randomUUID(), email: `b-${suffix}@test.local` } }),
  ]);
  userA = ua.id;
  userB = ub.id;

  const [ma] = await Promise.all([
    admin.organizationMembership.create({
      data: { organizationId: orgA, userId: userA, role: 'OWNER' },
    }),
    admin.organizationMembership.create({
      data: { organizationId: orgB, userId: userB, role: 'OWNER' },
    }),
  ]);
  membershipA = ma.id;
});

afterAll(async () => {
  // Limpieza con el rol de migraciones; el rol de runtime no puede borrar.
  await admin.organizationMembership.deleteMany({
    where: { organizationId: { in: [orgA, orgB] } },
  });
  await admin.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await Promise.all([admin.$disconnect(), app.$disconnect()]);
});

describe('aislamiento multi-tenant (RLS)', () => {
  it('la API se conecta con un rol sin SUPERUSER ni BYPASSRLS', async () => {
    const [role] = await app.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;

    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('sin withTenant, el rol de runtime no ve ninguna fila (falla cerrado)', async () => {
    const [orgs, memberships] = await Promise.all([
      app.organization.findMany({ where: { id: { in: [orgA, orgB] } } }),
      app.organizationMembership.findMany({ where: { organizationId: { in: [orgA, orgB] } } }),
    ]);

    expect(orgs).toEqual([]);
    expect(memberships).toEqual([]);
  });

  it('un club solo ve su propia organización', async () => {
    const orgs = await withTenant(orgA, (tx) => tx.organization.findMany(), app);

    expect(orgs.map((o) => o.id)).toEqual([orgA]);
  });

  it('con el contexto del club A, las membresías del club B devuelven cero filas', async () => {
    const rows = await withTenant(
      orgA,
      (tx) => tx.organizationMembership.findMany({ where: { organizationId: orgB } }),
      app,
    );

    expect(rows).toEqual([]);
  });

  it('un club solo ve a los usuarios que son miembros suyos', async () => {
    const users = await withTenant(
      orgA,
      (tx) => tx.user.findMany({ where: { id: { in: [userA, userB] } } }),
      app,
    );

    expect(users.map((u) => u.id)).toEqual([userA]);
  });

  it('el club A no puede crear una membresía en el club B', async () => {
    await expect(
      withTenant(
        orgA,
        (tx) =>
          tx.organizationMembership.create({
            data: { organizationId: orgB, userId: userA, role: 'ADMIN' },
          }),
        app,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('el club A no puede sumarse a un usuario ajeno para ver su email', async () => {
    await expect(
      withTenant(
        orgA,
        (tx) =>
          tx.organizationMembership.create({
            data: { organizationId: orgA, userId: userB, role: 'ADMIN' },
          }),
        app,
      ),
    ).rejects.toThrow(/permission denied/);

    const visible = await withTenant(
      orgA,
      (tx) => tx.user.findMany({ where: { id: userB } }),
      app,
    );
    expect(visible).toEqual([]);
  });

  it('el club A no puede reasignar su membresía a un usuario ajeno', async () => {
    await expect(
      withTenant(
        orgA,
        (tx) =>
          tx.organizationMembership.update({ where: { id: membershipA }, data: { userId: userB } }),
        app,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('el club A sí puede cambiar el rol de sus propias membresías', async () => {
    const updated = await withTenant(
      orgA,
      (tx) =>
        tx.organizationMembership.update({ where: { id: membershipA }, data: { role: 'ADMIN' } }),
      app,
    );

    expect(updated.role).toBe('ADMIN');
  });

  it('el club A no puede modificar la organización del club B', async () => {
    const result = await withTenant(
      orgA,
      (tx) => tx.organization.updateMany({ where: { id: orgB }, data: { name: 'Hackeado' } }),
      app,
    );

    expect(result.count).toBe(0);
    const orgBNow = await admin.organization.findUniqueOrThrow({ where: { id: orgB } });
    expect(orgBNow.name).toBe('Club B');
  });

  it('el rol de runtime no puede borrar: las bajas son lógicas', async () => {
    await expect(
      withTenant(
        orgA,
        (tx) => tx.organizationMembership.deleteMany({ where: { organizationId: orgA } }),
        app,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('el tenant y el rol no sobreviven a la transacción (seguro con pooling)', async () => {
    await withTenant(orgA, (tx) => tx.organization.findMany(), app);

    const [after] = await app.$queryRaw<{ tenant: string | null; role: string }[]>`
      SELECT NULLIF(current_setting('app.organization_id', true), '') AS tenant,
             current_user::text AS role
    `;

    expect(after.tenant).toBeNull();
    expect(after.role).not.toBe('miclub_app');
  });

  it('rechaza un organizationId que no es UUID', async () => {
    await expect(withTenant('club-a', (tx) => tx.organization.findMany(), app)).rejects.toThrow(
      /UUID/,
    );
  });
});
