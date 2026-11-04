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
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. El archivo [`frontend/vercel.json`](../frontend/vercel.json) fija el build de Vite
   (`npm run build`, salida `dist`) y el rewrite SPA hacia `index.html`.
7. Si el repo también queda conectado a Git, apagar los deploys automáticos de
   Vercel: el preview lo publica Actions.
8. Variables de entorno del proyecto (Preview y Production), no de GitHub:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`.
9. Registrar la URL pública en [`environments.md`](environments.md) cuando exista.

Referencia: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## 4. Pipeline (GitHub Actions)

Los workflows no tienen URLs ni connection strings. Si falta un secret, el job
avisa y no llama al proveedor. Eso no es un deploy.

Orden, cuando alguien tenga las cuentas:

1. En Supabase, copiar la connection string **directa** (puerto 5432, no el pooler
   6543) del rol que puede aplicar DDL. Ese rol no es `miclub_runtime`.
2. En GitHub → Settings → Secrets and variables → Actions, crear
   `MIGRATION_DATABASE_URL` con esa URL. No pegarla en Render ni en el repo.
3. En Render, abrir `miclub-api` y desactivar **Auto-Deploy** (sincronizar
   [`render.yaml`](render.yaml) también lo deja en `false`).
4. En el mismo servicio, crear un **Deploy Hook** y guardarlo como secret
   `RENDER_DEPLOY_HOOK_URL`. No commitearlo.
5. En Render, completar los valores que el blueprint deja en el dashboard:
   `DATABASE_URL` (alcanza para el `SELECT 1` de `/ready`; puede ser el rol de
   runtime), `RUNTIME_DATABASE_URL` (LOGIN, sin `SUPERUSER` ni `BYPASSRLS`,
   miembro de `miclub_app`), `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (JWT secret,
   no la anon key, 32 caracteres o más), `CORS_ORIGIN` (la URL estable del
   frontend, sin barra final). `CORS_ORIGIN_PATTERN` ya viene en el blueprint
   para los previews `*.vercel.app`.
6. En Vercel, crear un token y anotar el **Org ID** y el **Project ID** del
   proyecto con root `frontend`. Cargarlos como `VERCEL_TOKEN`, `VERCEL_ORG_ID`
   y `VERCEL_PROJECT_ID`.
7. Recién ahí, un push a `development` corre los tests, aplica
   `prisma migrate deploy` y pega al hook. Un PR que toca `frontend/` construye
   y, con esos secrets, publica un preview. `main` no migra ni despliega: en
   [`environments.md`](environments.md) hay un solo ambiente y su rama es
   `development`.

| Secret de Actions | Lo usa |
|---|---|
| `MIGRATION_DATABASE_URL` | `prisma migrate deploy` contra la base del ambiente |
| `RENDER_DEPLOY_HOOK_URL` | POST al hook después de migrar |
| `VERCEL_TOKEN` | CLI de Vercel |
| `VERCEL_ORG_ID` | CLI de Vercel |
| `VERCEL_PROJECT_ID` | CLI de Vercel |

## 5. Verificación del checkpoint 01

| Entregable | Cómo comprobarlo |
|---|---|
| Diagrama cloud | [01-cloud-checkpoint-01.md](../docs/architecture/01-cloud-checkpoint-01.md) |
| Setup de infra | Decisiones en [`environments.md`](environments.md) + proyectos provisionados + script [`verify-setup.sh`](verify-setup.sh) |
| Repo con actividad | Commits y PRs del equipo en GitHub |

Tras provisionar, ejecutar:

```bash
chmod +x infra/verify-setup.sh
./infra/verify-setup.sh https://TU-API.onrender.com https://TU-APP.vercel.app
```

## Archivos en este directorio

| Archivo | Propósito |
|---|---|
| [`render.yaml`](render.yaml) | Blueprint de Render para la API |
| [`environments.md`](environments.md) | Decisiones de despliegue, URLs y proyectos (sin secretos) |
| [`verify-setup.sh`](verify-setup.sh) | Comprobación mínima post-provisión (`/health` + frontend HTTPS) |
| [`README.md`](README.md) | Este procedimiento |
| [`.github/workflows/backend-ci.yml`](../.github/workflows/backend-ci.yml) | Tests de la API y, en `development`, migración + deploy hook |
| [`.github/workflows/frontend-ci.yml`](../.github/workflows/frontend-ci.yml) | Build del frontend y publish a Vercel |

## Fuera de alcance

- Worker, Cron, Mercado Pago e integración de IA
- Observabilidad (Sentry, métricas)
- Un segundo ambiente para `main`. Hasta que exista, el pipeline no despliega esa rama.

Worker, Cron y observabilidad corresponden a checkpoints posteriores según [docs/10-entrega-academica.md](../docs/10-entrega-academica.md).
