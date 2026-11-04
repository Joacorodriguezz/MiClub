# Módulo: auth

Autenticación de administradores con el access token de Supabase Auth.

- `requireTenant` valida firma, emisor, audiencia, vencimiento y `role = authenticated`.
- El club llega en `X-Organization-Id`. Hace falta ser miembro activo. El header solo no alcanza.
- Las queries del request pasan por `req.withTenant`, que llama a `withTenant` con el cliente de `RUNTIME_DATABASE_URL`.
- Ese cliente tiene que ser un rol sin `SUPERUSER` ni `BYPASSRLS`. Si no lo es, `GET /session` responde 503.
- `GET /session` devuelve `{ organizationId, role }`. No devuelve email.

Login en el navegador, logout y refresh quedan para el frontend.
