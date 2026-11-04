import type { PrismaClient } from '@prisma/client';
import type { Request, RequestHandler, Response } from 'express';
import type { TenantTransaction } from '../../infrastructure/database/tenant';
import { assertRuntimeConnection, RuntimeRoleRejected } from '../../infrastructure/database/runtimeClient';
import { readAuthConfig, verifyAccessToken } from './accessToken';
import { AuthUnavailableError, BadRequestError, ForbiddenError, HttpError, UnauthorizedError } from './errors';
import { findMembershipRole, type MembershipRoleName } from './membership';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SessionAuthContext = {
  authUserId: string;
  organizationId: string;
  role: MembershipRoleName;
};

export type WithTenant = <T>(fn: (tx: TenantTransaction) => Promise<T>) => Promise<T>;

declare global {
  namespace Express {
    interface Request {
      auth?: SessionAuthContext;
      withTenant?: WithTenant;
    }
  }
}

/**
 * Valida el access token, comprueba la membresía y deja `req.withTenant`
 * atado a ese club y al cliente de runtime. No usa el cliente de migraciones.
 */
export function requireTenant(runtimeClient: PrismaClient): RequestHandler {
  return (req, res, next) => {
    attachTenant(req, runtimeClient)
      .then(() => next())
      .catch((error: unknown) => sendAuthError(res, error));
  };
}

export function sendAuthError(res: Response, error: unknown): void {
  if (error instanceof HttpError) {
    if (error.status === 503) {
      console.error('GET /session: auth no configurada o conexión privilegiada');
    }
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('GET /session: fallo de auth');
  res.status(500).json({ error: 'Internal Server Error' });
}

async function attachTenant(req: Request, runtimeClient: PrismaClient): Promise<void> {
  const config = readAuthConfig();
  if (!config) {
    throw new AuthUnavailableError();
  }

  const token = readBearerToken(req.header('authorization'));
  if (!token) {
    throw new UnauthorizedError();
  }
  const { authUserId } = verifyAccessToken(token, config);

  const organizationId = req.get('X-Organization-Id')?.trim();
  if (!organizationId || !UUID_PATTERN.test(organizationId)) {
    throw new BadRequestError();
  }

  try {
    await assertRuntimeConnection(runtimeClient);
  } catch (error) {
    if (error instanceof RuntimeRoleRejected) {
      throw new AuthUnavailableError();
    }
    throw error;
  }

  const role = await findMembershipRole(runtimeClient, authUserId, organizationId);
  if (!role) {
    throw new ForbiddenError();
  }

  req.auth = { authUserId, organizationId, role };
  req.withTenant = async (fn) => {
    const { withTenant } = await import('../../infrastructure/database/tenant');
    return withTenant(organizationId, fn, runtimeClient);
  };
}

function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token || /\s/.test(token)) {
    return null;
  }
  return token;
}
