import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { assertRuntimeConnection } from './runtimeClient';

/**
 * Comprueba que la base del proceso responde.
 * `SELECT 1` no lee ni escribe datos de ningún club.
 */
export async function checkDatabase(client: PrismaClient = prisma): Promise<void> {
  await client.$queryRaw`SELECT 1`;
}

/**
 * Sonda de la conexión que atiende el tráfico autenticado (`RUNTIME_DATABASE_URL`).
 * Falla si el rol es superuser o tiene BYPASSRLS, o si la base no responde.
 */
export async function checkRuntimeDatabase(client: PrismaClient): Promise<void> {
  await assertRuntimeConnection(client);
  await checkDatabase(client);
}
