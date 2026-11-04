import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Comprueba que la base del proceso responde.
 * `SELECT 1` no lee ni escribe datos de ningún club.
 */
export async function checkDatabase(client: PrismaClient = prisma): Promise<void> {
  await client.$queryRaw`SELECT 1`;
}
