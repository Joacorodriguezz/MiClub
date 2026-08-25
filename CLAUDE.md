# MiClub — contexto del proyecto

SaaS liviano para que clubes gestionen su padrón de socios y **cobren las cuotas**
(Argentina, Mercado Pago). Multi-club desde el día uno.

Es además el **Trabajo Práctico Integrador** de *Ingeniería de Software en la Nube*
(UTN FRLP, 2026), en equipo de 3–4 integrantes. Los requisitos académicos y el
cronograma están en el [doc 10](docs/10-entrega-academica.md); no son opcionales y
condicionan el alcance.

**Estado: Fase 0 — definición. Todavía no hay código.**

Decidido hasta ahora:

- **D1 ✅ (2026-08-25):** la plata cae en la **cuenta de Mercado Pago de cada club**,
  conectada por OAuth. No custodiamos fondos de terceros. Ver [doc 04](docs/04-pagos-y-mercadopago.md).
- **D3 🟠 en curso:** hay contactos de clubes, ninguno confirmado. Guion en el [doc 08](docs/08-descubrimiento-club.md).
- **D6 ✅ (2026-08-25):** stack cerrado — **Next.js + Vercel + Supabase**. Matriz
  justificada y alternativas descartadas en el [doc 05](docs/05-arquitectura.md).
- **D12 ✅ (2026-08-25):** la IA del producto son el **importador inteligente de
  padrón** y la **conciliación semántica de pagos**. Ver [doc 09](docs/09-ia-en-el-producto.md).

## Mapa de documentos

| Doc | Para qué sirve |
|---|---|
| [docs/01-vision-y-negocio.md](docs/01-vision-y-negocio.md) | Problema, usuarios, propuesta de valor, modelo de negocio |
| [docs/02-glosario-y-dominio.md](docs/02-glosario-y-dominio.md) | Vocabulario y modelo de datos. **Leer antes de tocar el schema** |
| [docs/03-mvp.md](docs/03-mvp.md) | Alcance cerrado del MVP: qué entra, qué no, criterios de aceptación |
| [docs/04-pagos-y-mercadopago.md](docs/04-pagos-y-mercadopago.md) | La decisión más cara del proyecto: cómo fluye la plata |
| [docs/05-arquitectura.md](docs/05-arquitectura.md) | Multi-tenancy, stack, seguridad, jobs |
| [docs/06-decisiones-abiertas.md](docs/06-decisiones-abiertas.md) | Preguntas sin responder que bloquean o condicionan |
| [docs/07-roadmap.md](docs/07-roadmap.md) | Fases y orden de construcción |
| [docs/08-descubrimiento-club.md](docs/08-descubrimiento-club.md) | Guion de entrevista para hablar con clubes candidatos |
| [docs/09-ia-en-el-producto.md](docs/09-ia-en-el-producto.md) | La IA **dentro del producto**: qué hace, cómo se integra, cómo degrada |
| [docs/10-entrega-academica.md](docs/10-entrega-academica.md) | Requisitos del TPI: hitos, Git, PRs, kanban, CI/CD, defensa |
| [ONE-PAGER.md](ONE-PAGER.md) | Entregable de la Clase 1 |
| [AI-DECISIONS.md](AI-DECISIONS.md) | Log de auditoría del uso de IA **para desarrollar**. Obligatorio |

## Reglas no negociables

Aplican a todo el código, sin excepción. Si algo las contradice, es un bug.

1. **La plata es un ledger, no un campo.** No existe `socio.saldo` mutable.
   El saldo se *deriva* de `cargos` − `aplicaciones_pago`. Los registros de dinero
   son inmutables: se corrigen con contraasientos, nunca con `UPDATE`.
   Un tesorero que ve un número cambiar sin explicación deja de usar el producto.
2. **Montos en enteros (centavos), nunca float.** Columna `bigint`, moneda explícita (`ARS`).
3. **Todo query lleva `club_id`.** No hay lectura ni escritura sin tenant.
   El aislamiento se garantiza en la base (RLS), no en el código de aplicación.
4. **Los webhooks son no confiables.** Llegan duplicados, desordenados o nunca.
   Todo handler es idempotente y existe un job de reconciliación que consulta a MP
   como fuente de verdad.
5. **El estado "al día / moroso" es derivado.** Se calcula, se cachea, se recalcula.
   Nunca se edita a mano.
6. **Nada se borra.** Bajas lógicas y auditoría (`quién`, `cuándo`, `qué`) en
   socios, cargos, pagos y configuración de precios.
7. **Fechas y períodos con zona horaria explícita** (`America/Argentina/Buenos_Aires`).
   Un cierre de período corrido un día arruina la cobranza del mes.
8. **La IA propone, el humano confirma.** Ningún socio entra al padrón y ningún peso
   se aplica al ledger por decisión autónoma de un modelo. Y la IA nunca es punto
   único de falla: si falla, el flujo manual sigue disponible.

## Convenciones

- El dominio se nombra **en español** (`socio`, `cuota`, `cargo`, `periodo`).
  El código de infraestructura, en inglés. No mezclar dentro de una misma capa.
- Documentos numerados; si se agrega uno nuevo, se agrega también a esta tabla.
- **Commits en Conventional Commits**, con el módulo del dominio como scope:
  `feat(socios):`, `fix(cobranza):`, `feat(ia):`. Detalle en el [doc 10](docs/10-entrega-academica.md).
- Si un asistente de IA participó en una decisión de diseño o en código que llega a
  `main`, se agrega una entrada en [AI-DECISIONS.md](AI-DECISIONS.md).
