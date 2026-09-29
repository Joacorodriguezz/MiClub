# Registro de ambientes

Completar **después** de provisionar en cada consola. No versionar secretos ni pegar
tokens reales en este archivo.

## Entorno inicial (checkpoint 01)

| Componente | Proveedor | Proyecto / servicio | URL pública | Responsable | Fecha |
|---|---|---|---|---|---|
| Frontend (SPA) | Vercel | _(completar)_ | _(completar)_ | | |
| API (`/health`) | Render | _(completar)_ | _(completar)_ | | |
| PostgreSQL | Supabase | _(completar project ref)_ | — | | |
| Auth + Storage | Supabase | _(mismo proyecto)_ | — | | |

## Comprobaciones mínimas

- [ ] Frontend responde por HTTPS (página estática o placeholder de Vite).
- [ ] `GET {URL_API}/health` devuelve `{ "status": "ok" }`.
- [ ] La API en Render tiene `DATABASE_URL` configurada (aunque aún no haya modelos).
- [ ] Las variables del frontend apuntan a Supabase y a la URL de la API.

## Región y plan (completar)

| Servicio | Región elegida | Plan | Notas |
|---|---|---|---|
| Supabase | _(completar)_ | _(completar)_ | Preferir región cercana a Argentina |
| Render API | _(completar)_ | _(completar)_ | Free tier tiene cold start |
| Vercel | _(completar)_ | _(completar)_ | Hobby suele alcanzar para el MVP |
