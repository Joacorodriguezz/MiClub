import { PrismaClient } from '@prisma/client';

/** La conexión no es un rol de runtime: es superuser o tiene BYPASSRLS. */
export class RuntimeRoleRejected extends Error {
  constructor() {
    super('runtime role rejected');
  }
}

/**
 * Cliente de la API para auth y `withTenant`.
 * Recibe la URL ya resuelta: no lee `DATABASE_URL` ni cae al rol de migraciones.
 */
export function createRuntimeClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}

const acceptedClients = new WeakSet<PrismaClient>();

/**
 * Falla si `current_user` de esta conexión es superuser o tiene BYPASSRLS.
 * No lee datos de ningún club.
 */
export async function assertRuntimeConnection(client: PrismaClient): Promise<void> {
  if (acceptedClients.has(client)) {
    return;
  }

  const rows = await client.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT rolsuper, rolbypassrls
    FROM pg_roles
    WHERE rolname = current_user
  `;
  const role = rows[0];
  if (!role || role.rolsuper || role.rolbypassrls) {
    throw new RuntimeRoleRejected();
  }
  acceptedClients.add(client);
}
