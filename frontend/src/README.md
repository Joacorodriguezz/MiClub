# frontend/src

Una sola aplicación React + Vite para el MVP (no apps separadas por rol). La
separación entre contextos se resuelve con **layouts, rutas, permisos y features**.

Tres contextos principales (ver `layouts/`):

- **Platform** (`PlatformLayout`) — panel de administración de MiClub SaaS.
- **Organization** (`OrganizationLayout`) — panel administrativo del club.
- **Portal** (`PortalLayout`) — portal de jugador, socio o responsable.

Carpetas:

- `app/` — composición raíz de la app (router, providers).
- `features/` — código por dominio (auth, organizations, people, sports, finance,
  payments, platform).
- `layouts/` — los tres contextos de arriba.
- `pages/` — pantallas montadas por el router.
- `shared/` — components, hooks, api, utils, types realmente transversales.
- `assets/` — estáticos.

La raíz (`/`) consulta `GET /health` y `GET /ready` de la API usando `VITE_API_URL`.
El resto de features y layouts sigue vacío.
