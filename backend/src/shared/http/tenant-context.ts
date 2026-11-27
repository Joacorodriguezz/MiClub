import type { Request, RequestHandler } from 'express';
import type { TenantTransaction } from '../../infrastructure/database/tenant';
import { requireTenant as requireSession } from '../../modules/auth/requireTenant';
import type { SessionAuth } from '../../modules/auth/router';
import { HttpError } from '../errors/http-error';

/**
 * Contexto del request autenticado, tal como lo deja el middleware del módulo
 * `auth`: JWT válido, membresía activa en el club de `X-Organization-Id` y
 * `withTenant` atado a ese club con el cliente de runtime.
 */
export interface TenantContext {
  organizationId: string;
  authUserId: string;
  run: <T>(fn: (tx: TenantTransaction) => Promise<T>) => Promise<T>;
}

const unauthorized = () =>
  new HttpError(401, 'Se requiere un usuario autenticado con un club seleccionado');

/**
 * Middleware de las rutas de negocio. Sin auth configurada responde 503, igual
 * que `/session`: falla cerrado, nunca se toma el club de un header sin validar.
 */
export function tenantGuard(auth: SessionAuth | undefined): RequestHandler {
  if (!auth) {
    return (_req, res) => {
      res.status(503).json({ error: 'Auth no configurada' });
    };
  }
  return requireSession(auth.runtimeClient, auth.keys);
}

export function getTenant(req: Request): TenantContext {
  if (!req.auth || !req.withTenant) {
    throw unauthorized();
  }
  return {
    organizationId: req.auth.organizationId,
    authUserId: req.auth.authUserId,
    run: req.withTenant,
  };
}

/**
 * Id interno (`users.id`) del usuario autenticado, para las columnas de
 * auditoría (`issued_by_user_id`, `recorded_by_user_id`). RLS deja ver solo a
 * los miembros del club, y el middleware ya comprobó que lo es.
 */
export async function currentUserId(tx: TenantTransaction, authUserId: string): Promise<string> {
  const user = await tx.user.findFirst({
    where: { authUserId, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    throw unauthorized();
  }
  return user.id;
}
