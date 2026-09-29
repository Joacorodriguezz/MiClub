# Registro de ambientes

Registro de proyectos cloud para el **Checkpoint 01**. No versionar secretos ni pegar
tokens reales en este archivo.

**Estado:** decisiones de despliegue cerradas (2026-09-28). URLs públicas: completar
tras el sprint de provisión (~15 min) siguiendo [`README.md`](README.md).

## Entorno inicial (checkpoint 01)

| Componente | Proveedor | Proyecto / servicio | URL pública | Responsable | Fecha |
|---|---|---|---|---|---|
| Frontend (SPA) | Vercel | `miclub-frontend` | _(completar tras deploy)_ | M1 · Plataforma | |
| API (`/health`) | Render | `miclub-api` (Blueprint) | _(completar tras deploy)_ | M1 · Plataforma | |
| PostgreSQL | Supabase | `miclub-dev` | — | M1 · Plataforma | |
| Auth + Storage | Supabase | _(mismo proyecto)_ | — | M1 · Plataforma | |

**Rama de despliegue:** `development`  
**Repositorio:** `Joacorodriguezz/MiClub`

## Decisiones cerradas (sección 6.1 del doc cloud)

### Proveedores y planes

| Función | Proveedor | Plan inicial | Condiciones relevantes |
|---|---|---|---|
| Frontend estático | Vercel | Hobby (gratuito) | CDN global, previews por PR, build desde `frontend/` |
| API Express | Render | Free Web Service | Cold start ~30–60 s; suficiente para CP1; upgrade a Starter si webhooks lo exigen (CP2) |
| Postgres + Auth + Storage | Supabase | Free | 500 MB DB, 50k MAU Auth; pausa por inactividad tras 7 días sin uso |
| Worker / Cron | Render | _(CP2)_ | No provisionado en CP1 |

### Región y conectividad

| Servicio | Región | Modo de conexión | Notas |
|---|---|---|---|
| Supabase (DB) | **South America (São Paulo)** | Connection string directa o pooler Supabase → Prisma | Menor latencia desde Argentina que US/EU |
| Render (API) | **Oregon (US West)** | HTTPS público; Postgres vía TLS a Supabase | Free tier Render no ofrece SA; latencia API↔DB aceptable para CP1 |
| Vercel (frontend) | **Edge global** (origen build US) | HTTPS; llama a API Render y Supabase Auth | Sin región fija; CDN distribuye assets estáticos |

**Comprobación de conectividad (post-provisión):** desde Render, `DATABASE_URL` configurada y
deploy en verde; `GET /health` responde sin depender de DB (CP1). Conexión Prisma→Postgres
se valida en CP2 con schema y migraciones.

### Capacidad y presupuesto

| Supuesto | Valor |
|---|---|
| Clubes en CP1 | 0 (solo setup) |
| Socios simulados CP2 | ≤ 500 |
| Instancia API | 1 × Render Free (512 MB RAM) |
| Conexiones DB | Pool Prisma ≤ 5 en free tier |
| **Costo mensual estimado** | **USD 0** (planes gratuitos) |
| **Fuente / fecha** | Pricing público Vercel, Render y Supabase; 2026-09-28 |
| Upgrade previsto CP2 | Render Starter (~USD 7/mes) si cold start o uptime lo requieren |

### Ambientes y operación

| Ambiente | Propósito | Datos | Secretos |
|---|---|---|---|
| Local | Desarrollo | Docker Postgres o Supabase dev | `.env` / `.env.local` (gitignored) |
| Preview | PR en Vercel | Aislado o compartido con dev | Variables en dashboard Vercel |
| Dev cloud (CP1) | Evidencia de setup | Proyecto Supabase dedicado | Render + Vercel dashboards |

**Backup (CP1):** Supabase Free incluye backups diarios gestionados (retención limitada por
plan). Política formal de RPO/RTO se define en CP2 al tener datos de negocio.

## Comprobaciones mínimas

Ejecutar tras provisionar (o usar [`verify-setup.sh`](verify-setup.sh)):

- [ ] Frontend responde por HTTPS (página estática o placeholder de Vite).
- [ ] `GET {URL_API}/health` devuelve `{ "status": "ok" }`.
- [ ] La API en Render tiene `DATABASE_URL` configurada (aunque aún no haya modelos).
- [ ] Las variables del frontend apuntan a Supabase y a la URL de la API.

## Región y plan (registro post-provisión)

Completar la columna **Fecha** y las URLs de la primera tabla cuando existan los proyectos.

| Servicio | Región elegida | Plan | Notas |
|---|---|---|---|
| Supabase | South America (São Paulo) | Free | Project ref: _(completar)_ |
| Render API | Oregon (US West) | Free | Service ID: _(completar)_ |
| Vercel | Edge global | Hobby | Project: _(completar)_ |
