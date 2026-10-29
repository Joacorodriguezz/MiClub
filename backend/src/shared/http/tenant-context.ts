import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error';

/**
 * Contexto del request autenticado. Lo setea el middleware de auth (módulo
 * `auth`, pendiente): valida el JWT de Supabase, resuelve la membresía y deja
 * acá el club elegido. Mientras ese middleware no exista, toda ruta de negocio
 * responde 401: falla cerrado, nunca se toma el club de un header del cliente.
 */
export interface TenantContext {
  organizationId: string;
  userId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

const unauthorized = () =>
  new HttpError(401, 'Se requiere un usuario autenticado con un club seleccionado');

export function requireTenant(req: Request, _res: Response, next: NextFunction): void {
  next(req.tenant ? undefined : unauthorized());
}

export function getTenant(req: Request): TenantContext {
  if (!req.tenant) {
    throw unauthorized();
  }
  return req.tenant;
}
