import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { requireTenant, sendAuthError } from './requireTenant';

export type SessionAuth = {
  runtimeClient: PrismaClient;
};

/**
 * `GET /session` confirma el token y la membresía.
 * La respuesta es el id de la organización y el rol. No incluye email.
 */
export function createSessionRouter(auth?: SessionAuth): Router {
  const router = Router();

  if (!auth) {
    router.get('/session', (_req, res) => {
      res.status(503).json({ error: 'Auth no configurada' });
    });
    return router;
  }

  router.get('/session', requireTenant(auth.runtimeClient), async (req, res) => {
    const organizationId = req.auth?.organizationId;
    const run = req.withTenant;
    if (!organizationId || !run || !req.auth) {
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    try {
      const orgs = await run((tx) => tx.organization.findMany({ select: { id: true } }));
      const foreign = orgs.some((org) => org.id !== organizationId);
      const own = orgs.filter((org) => org.id === organizationId);
      if (foreign || own.length !== 1) {
        res.status(403).json({ error: 'Sin acceso' });
        return;
      }
      res.status(200).json({ organizationId: own[0]?.id, role: req.auth.role });
    } catch (error) {
      sendAuthError(res, error);
    }
  });

  return router;
}
