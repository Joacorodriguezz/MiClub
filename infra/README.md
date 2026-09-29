# Infraestructura — MiClub (Checkpoint 01)

Setup inicial de la arquitectura cloud definida en
[docs/architecture/01-cloud-checkpoint-01.md](../docs/architecture/01-cloud-checkpoint-01.md).

**Topología:** Vercel (frontend) + Render (API) + Supabase (Postgres, Auth, Storage).

Este directorio versiona la **configuración y el procedimiento** de despliegue. Las
URLs y credenciales reales se registran en [`environments.md`](environments.md) una vez
provisionados los servicios (sin secretos en el repo).

## Prerrequisitos

- Cuentas en [Vercel](https://vercel.com), [Render](https://render.com) y
  [Supabase](https://supabase.com)
- Node.js 20+ en local para probar builds
- Repositorio conectado a GitHub (`Joacorodriguezz/MiClub`)

## 1. Supabase (datos, auth, storage)

1. Crear un proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Anotar **Project URL** y **anon public key** (frontend).
3. En *Settings → Database*, copiar la **connection string** para Prisma
   (modo *Session* o *Transaction* según documentación de Prisma + Supabase).
4. Crear un rol de runtime **sin** `BYPASSRLS` para la API (checkpoint 02).
5. Registrar project ref y región en [`environments.md`](environments.md).

Variables resultantes → ver [`backend/.env.example`](../backend/.env.example) y
[`frontend/.env.example`](../frontend/.env.example).

## 2. Render (API Express)

1. En Render: **New → Blueprint**.
2. Conectar el repo y seleccionar [`infra/render.yaml`](render.yaml).
3. Configurar secretos en el dashboard de Render:
   - `DATABASE_URL` — connection string de Supabase
   - `CORS_ORIGIN` — URL del frontend en Vercel (cuando exista)
4. Verificar health check en `/health` tras el primer deploy.
5. Registrar la URL pública en [`environments.md`](environments.md).

Referencia: [Deploy Node Express on Render](https://render.com/docs/deploy-node-express-app).

## 3. Vercel (frontend React/Vite)

1. En Vercel: **Add New → Project** → importar el repo.
2. **Root Directory:** `frontend`
3. **Framework Preset:** Vite
4. **Build Command:** `npm run build` *(cuando existan dependencias)*
5. **Output Directory:** `dist`
6. El archivo [`frontend/vercel.json`](../frontend/vercel.json) configura el rewrite
   SPA hacia `index.html`.
7. Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`.
8. Registrar la URL pública en [`environments.md`](environments.md).

Referencia: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## 4. Verificación del checkpoint 01

| Entregable | Cómo comprobarlo |
|---|---|
| Diagrama cloud | [01-cloud-checkpoint-01.md](../docs/architecture/01-cloud-checkpoint-01.md) |
| Setup de infra | Proyectos creados + [`environments.md`](environments.md) completado + configs en este directorio |
| Repo con actividad | Commits y PRs del equipo en GitHub |

## Archivos en este directorio

| Archivo | Propósito |
|---|---|
| [`render.yaml`](render.yaml) | Blueprint de Render para la API |
| [`environments.md`](environments.md) | Registro de URLs y proyectos (sin secretos) |
| [`README.md`](README.md) | Este procedimiento |

## Fuera de alcance del checkpoint 01

- CI/CD con GitHub Actions
- Migraciones Prisma, RLS y tests de aislamiento
- Worker, Cron, Mercado Pago e integración de IA
- Observabilidad (Sentry, métricas)

Corresponden a checkpoints posteriores según [docs/10-entrega-academica.md](../docs/10-entrega-academica.md).
