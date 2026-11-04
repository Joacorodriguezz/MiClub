import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma de proceso. Lee DATABASE_URL del entorno.
 * GET /health no lo importa: el proceso puede levantar sin DB.
 * GET /ready lo carga recién cuando llega el request.
 */
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
