import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma de proceso. Lee DATABASE_URL del entorno.
 * No se importa desde el health check: el proceso puede levantar sin DB.
 */
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
