import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

/** Rol de Postgres sin BYPASSRLS creado por la migración `init_tenancy`. */
const RUNTIME_ROLE = 'miclub_app';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantTransaction = Prisma.TransactionClient;

/**
 * Ejecuta `fn` dentro de una transacción con el tenant fijado en Postgres.
 *
 * Asume el rol `miclub_app` y setea `app.organization_id`, ambos con alcance de
 * transacción (`SET LOCAL` / `set_config(..., true)`). Así el aislamiento lo
 * hacen cumplir las políticas RLS sin depender de con qué usuario se conectó la
 * API, y el contexto no sobrevive a la transacción: con un pooler en modo
 * transacción (Supavisor/PgBouncer) un request nunca hereda el tenant de otro.
 *
 * Toda query de negocio tiene que pasar por acá.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
  client: PrismaClient = prisma,
): Promise<T> {
  if (!UUID_PATTERN.test(organizationId)) {
    throw new Error('organizationId inválido: se esperaba un UUID');
  }

  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${RUNTIME_ROLE}`);
    await tx.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
    return fn(tx);
  });
}
