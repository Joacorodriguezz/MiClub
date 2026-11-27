import type { PrismaClient } from '@prisma/client';

export type MembershipRoleName = 'OWNER' | 'ADMIN';

/**
 * Rol del usuario en esa organización, o null si no es miembro activo.
 * La función SQL no devuelve email ni otras filas.
 */
export async function findMembershipRole(
  client: PrismaClient,
  authUserId: string,
  organizationId: string,
): Promise<MembershipRoleName | null> {
  const rows = await client.$queryRaw<{ role: string | null }[]>`
    SELECT app_membership_role(CAST(${authUserId} AS uuid), CAST(${organizationId} AS uuid)) AS role
  `;
  const role = rows[0]?.role ?? null;
  if (role === 'OWNER' || role === 'ADMIN') {
    return role;
  }
  return null;
}
