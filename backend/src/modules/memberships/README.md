# Módulo: memberships

Relación User → OrganizationMembership → Organization.

Un usuario NO es un jugador. Este módulo modela el acceso de un usuario a una
organización.

Implementado:
- Modelo `OrganizationMembership` con rol (`OWNER` / `ADMIN`) y RLS por organización
  (migración `init_tenancy`).
- Contexto de tenant: `withTenant` en `src/infrastructure/database/tenant.ts`.

Pendiente:
- resolver el tenant del request desde el JWT de Supabase Auth y la membresía
- permisos por rol
