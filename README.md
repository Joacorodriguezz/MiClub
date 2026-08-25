# MiClub

SaaS de gestión de socios y cobranza de cuotas para clubes. Argentina, Mercado Pago,
multi-tenant desde el día uno.

> **Estado: Fase 0 — definición.** La documentación de producto y arquitectura está
> cerrada; el desarrollo todavía no arrancó.

## El problema

Un club de barrio con 300 a 2000 socios cobra la cuota con un Excel, mensajes de
WhatsApp uno por uno y transferencias sin referencia. El resultado es siempre el
mismo: morosidad alta que nadie mide, cobranza tardía, y todo el conocimiento en la
cabeza de una sola persona.

El dolor no es "no tener un sistema de socios". El dolor es **plata que no entra**.
Eso define todo el producto: cada feature se justifica por su impacto en cobrabilidad.

## Qué hace

- **Padrón vivo** con estado de deuda derivado de un ledger auditable, no anotado a mano
- **Link de pago** por Mercado Pago, sin login ni app para el socio
- **Emisión mensual** idempotente de cuotas, con grupos familiares como unidad de cobro
- **Pagos manuales** (efectivo y transferencia) como ciudadanos de primera clase
- **Importador inteligente** que lee el Excel del club tal como está
- **Conciliación semántica** de transferencias sin referencia

## Diferenciador con IA

Dos funciones, ninguna decorativa. Ambas atacan fricciones documentadas que hoy hacen
fracasar la adopción:

| Función | Qué resuelve |
|---|---|
| **Importador inteligente de padrón** | Un LLM interpreta el Excel real —columnas arbitrarias, nombre y apellido en una celda, DNI mal tipeado, categorías con typos— y propone mapeo, normalización y grupos familiares. Convierte 2 horas de carga manual en 5 minutos |
| **Conciliación semántica de pagos** | Ante una transferencia que dice `TRANSF JUAN P` por $15.000, propone a qué socio corresponde, con score y justificación |

En ambos casos **la IA propone y una persona confirma**. Y si el proveedor de IA falla,
el flujo manual sigue disponible: la IA nunca es punto único de falla.

Detalle en [docs/09-ia-en-el-producto.md](docs/09-ia-en-el-producto.md).

## Stack

| Componente | Elección |
|---|---|
| Frontend | Next.js (App Router) + TypeScript en Vercel |
| Backend / API | Route Handlers + Vercel Functions (serverless) |
| Persistencia | Supabase Postgres, con Row Level Security |
| Auth | Supabase Auth |
| Jobs | Cola en Postgres + Vercel Cron |
| IA | Claude API con salida estructurada |
| Pagos | Mercado Pago en modo marketplace (OAuth) |
| Observabilidad | Sentry + logs estructurados por `club_id` |

La justificación de cada componente, con alternativas evaluadas y descartadas, está en
[docs/05-arquitectura.md](docs/05-arquitectura.md).

## Documentación

Empezar por [CLAUDE.md](CLAUDE.md): contexto del proyecto y **reglas no negociables**.

| Doc | Para qué sirve |
|---|---|
| [01 · Visión y negocio](docs/01-vision-y-negocio.md) | Problema, usuarios, propuesta de valor, modelo de negocio |
| [02 · Glosario y dominio](docs/02-glosario-y-dominio.md) | Vocabulario y modelo de datos. **Leer antes de tocar el schema** |
| [03 · MVP](docs/03-mvp.md) | Alcance cerrado: qué entra, qué no, criterios de aceptación |
| [04 · Pagos y Mercado Pago](docs/04-pagos-y-mercadopago.md) | La decisión más cara del proyecto: cómo fluye la plata |
| [05 · Arquitectura](docs/05-arquitectura.md) | Multi-tenancy, stack justificado, diseño cloud-native, seguridad |
| [06 · Decisiones abiertas](docs/06-decisiones-abiertas.md) | Qué está decidido, qué no, y qué bloquea |
| [07 · Roadmap](docs/07-roadmap.md) | Fases y orden de construcción |
| [08 · Descubrimiento](docs/08-descubrimiento-club.md) | Guion de entrevista para hablar con clubes |
| [09 · IA en el producto](docs/09-ia-en-el-producto.md) | Diseño de las funciones asistidas por IA |
| [10 · Entrega académica](docs/10-entrega-academica.md) | Requisitos del TPI, hitos y estándares de ingeniería |

## Reglas no negociables

Resumidas; completas en [CLAUDE.md](CLAUDE.md). Si algo las contradice, es un bug.

1. **La plata es un ledger, no un campo.** No existe `socio.saldo` mutable
2. **Montos en enteros** (centavos), nunca float
3. **Todo query lleva `club_id`.** El aislamiento se garantiza en la base, con RLS
4. **Los webhooks son no confiables.** Handlers idempotentes + reconciliación
5. **El estado "al día / moroso" es derivado.** Se calcula, nunca se edita
6. **Nada se borra.** Bajas lógicas y auditoría
7. **Fechas con zona horaria explícita** (`America/Argentina/Buenos_Aires`)
8. **La IA propone, el humano confirma**

## Contexto académico

Trabajo Práctico Integrador de *Ingeniería de Software en la Nube* — UTN FRLP,
Departamento de Ingeniería en Sistemas de Información, ciclo lectivo 2026.

| Hito | Fecha | Entregable |
|---|---|---|
| Clase 1 | 24/08/2026 | [One-Pager](ONE-PAGER.md) ✅ |
| Checkpoint 1 | 28/09/2026 | Arquitectura, infraestructura y repo con actividad |
| Checkpoint 2 | 09/11/2026 | Demo funcional desplegada |
| Defensa final | 30/11/2026 | MVP en producción |

## Cómo contribuir

- **Conventional Commits**, con el módulo del dominio como scope:
  `feat(socios):`, `fix(cobranza):`, `docs(ia):`
- **Nadie mergea su propio PR.** Revisión cruzada obligatoria
- **Límite de WIP:** una tarea en curso por persona
- Si un asistente de IA participó en una decisión de diseño o en código que llega a
  `main`, se agrega una entrada en [AI-DECISIONS.md](AI-DECISIONS.md)

Detalle completo en [docs/10-entrega-academica.md](docs/10-entrega-academica.md).
