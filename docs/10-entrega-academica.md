# 10 — Entrega académica (TPI)

Requisitos del Trabajo Práctico Integrador de *Ingeniería de Software en la Nube*
(UTN FRLP, 2026) y cómo los cumple este repositorio.

Este documento existe porque el TPI evalúa explícitamente **el cómo**, no solo el qué:
historial de Git, revisiones cruzadas, gestión del tablero, observabilidad y auditoría
del uso de IA.

## Mapeo requisito → dónde se cumple

| Requisito del TPI | Dónde |
|---|---|
| MVP bajo modelo SaaS | [03-mvp.md](03-mvp.md) |
| Arquitectura cloud-native (elasticidad, desacoplamiento, alta disponibilidad) | [05-arquitectura.md](05-arquitectura.md) |
| Servicios gestionados, con justificación | [05-arquitectura.md](05-arquitectura.md) y [ONE-PAGER.md](../ONE-PAGER.md) |
| **IA como diferenciador de negocio (mandatoria)** | [09-ia-en-el-producto.md](09-ia-en-el-producto.md) |
| **`AI-DECISIONS.md` en la raíz** | [../AI-DECISIONS.md](../AI-DECISIONS.md) |
| Libertad tecnológica justificada (trade-offs evaluados) | [05-arquitectura.md](05-arquitectura.md), sección Stack |
| Conventional Commits | Este doc, sección Git |
| Pull Requests cruzados | Este doc, sección PRs |
| Kanban con límites de WIP | Este doc, sección Tablero |
| Observabilidad | [05-arquitectura.md](05-arquitectura.md) y [09-ia-en-el-producto.md](09-ia-en-el-producto.md) |
| CI/CD con GitHub Actions | Este doc, sección CI/CD |
| Justificación técnica de cada servicio cloud | [05-arquitectura.md](05-arquitectura.md) |

## Cronograma

| Hito | Fecha | Entregable | Estado |
|---|---|---|---|
| Clase 1 | 24/08/2026 | One-Pager | ✅ [ONE-PAGER.md](../ONE-PAGER.md) |
| Checkpoint 1 | 28/09/2026 | Definición de arquitectura, setup de infra, repo con actividad | ⬜ |
| Checkpoint 2 | 09/11/2026 | Demo funcional desplegada, backend operativo, pruebas de integración | ⬜ |
| Defensa final | 30/11/2026 | MVP en producción, presentación en vivo | ⬜ |

**Presupuesto real: 14 semanas.** Con equipo part-time, es el dato que manda sobre el
alcance. Ver el recorte asumido al final del [doc 03](03-mvp.md).

### Checkpoint 1 — 28/09 (5 semanas)

Lo que tiene que estar funcionando, no descrito:

- [ ] Diagrama de arquitectura cloud detallado (componentes, flujos, límites de tenant)
- [ ] Proyecto Supabase y proyecto Vercel creados y conectados
- [ ] Repositorio propio, con **actividad distribuida entre los integrantes**
- [ ] Schema inicial migrado: clubes, usuarios, socios, cuentas, categorías, precios
- [ ] RLS activo **con test de aislamiento multi-tenant corriendo en CI**
- [ ] Pipeline de GitHub Actions en verde
- [ ] Tablero de GitHub Projects poblado y en uso
- [ ] `AI-DECISIONS.md` con entradas reales del período

> El riesgo de este checkpoint no es técnico: es llegar con un repo de tres commits.
> La evaluación individual se hace sobre el historial.

### Checkpoint 2 — 09/11 (6 semanas)

- [ ] Padrón completo: socios, cuentas, grupos familiares, categorías y precios
- [ ] **Importador inteligente (IA-1)** funcionando sobre un Excel real
- [ ] Períodos y emisión idempotente de cargos
- [ ] Ledger: cargos, pagos manuales, aplicación, saldo
- [ ] OAuth de Mercado Pago y checkout en **sandbox**
- [ ] Webhooks con validación de firma, deduplicación y job de reconciliación
- [ ] Pruebas de integración del flujo de cobro completo
- [ ] Desplegado y accesible por URL

### Defensa final — 30/11 (3 semanas)

- [ ] **Conciliación semántica (IA-2)**
- [ ] Panel de morosos y métricas
- [ ] Observabilidad: logs centralizados, métricas, alertas
- [ ] Endurecimiento: rate limiting, manejo de errores, presupuesto de IA
- [ ] Datos de demostración cargados y guion de demo ensayado
- [ ] Ensayo de defensa con preguntas cruzadas entre integrantes

## División de trabajo

El TPI audita **frecuencia, calidad y autoría de los commits** para evaluar
individualmente. La división por módulos con carpetas propias no es burocracia: es lo
que hace que el historial de Git sea legible como evidencia de contribución.

| Módulo | Alcance | Carpetas |
|---|---|---|
| **M1 · Plataforma** | Auth, clubes, roles, RLS, CI/CD, observabilidad, despliegue | `clubes/`, `compartido/`, `.github/` |
| **M2 · Padrón** | Socios, cuentas, categorías, precios, importador **+ IA-1** | `socios/`, `ia/importador/` |
| **M3 · Cobranza** | Períodos, emisión, ledger, aplicación de pagos, **+ IA-2** | `cuotas/`, `cobranza/`, `ia/conciliacion/` |
| **M4 · Pagos** | OAuth de MP, checkout, webhooks, reconciliación | `pagos-mp/` |

**Si son 3 integrantes:** M4 se reparte — OAuth y checkout van a M1, webhooks y
reconciliación a M3, que es donde vive el ledger.

Reglas de convivencia:

- Cada módulo tiene **un dueño**. Puede recibir ayuda, pero responde por él en la defensa.
- Cambios al esquema compartido (`compartido/`, migraciones) requieren PR con dos revisores.
- **Todos deben poder defender la arquitectura completa**, no solo su módulo. Ver la
  sección de preparación al final.

## Git

**Conventional Commits, obligatorio.** El scope es el módulo del dominio:

```
feat(socios): importar padron desde CSV con mapeo asistido
fix(cobranza): evitar cargos duplicados al reemitir un periodo
refactor(pagos-mp): aislar el cliente de MP detras de la interfaz
test(clubes): agregar test de aislamiento multi-tenant
docs(ia): documentar el presupuesto de tokens por club
chore(ci): agregar typecheck al pipeline
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.

| ❌ Evitar | ✅ Preferir |
|---|---|
| `cambios` | `feat(socios): agregar baja logica de socio` |
| `arreglos varios` | `fix(cuotas): corregir vencimiento con zona horaria` |
| `avance TP` | `feat(cobranza): aplicar pago a cargos mas antiguos primero` |
| Un commit de 40 archivos el 28/09 | Commits chicos, a lo largo de las 5 semanas |

El enunciado dice explícitamente que **no se aceptan "grandes commits" de último
momento**. Un historial con actividad concentrada en los días previos a cada
checkpoint es peor que uno con menos volumen pero sostenido.

Ramas: `tipo/modulo-descripcion-corta` → `feat/socios-importador-csv`.

## Pull Requests

**Nadie mergea su propio PR.** Revisión cruzada obligatoria: además de calidad, es el
mecanismo de conocimiento compartido que hace posible defender módulos ajenos.

Plantilla sugerida (`.github/pull_request_template.md`):

```markdown
## Qué hace
<descripción en una o dos frases>

## Por qué
<problema que resuelve; link a la tarea del tablero>

## Cómo probarlo
<pasos concretos>

## Checklist
- [ ] Respeta las reglas no negociables del CLAUDE.md
- [ ] Todo query nuevo filtra por club_id / pasa por RLS
- [ ] Montos manejados en enteros
- [ ] Tests agregados o actualizados
- [ ] Si hubo IA involucrada en el diseño, entrada en AI-DECISIONS.md
```

## Tablero

GitHub Projects con límites de Work In Progress:

| Columna | Límite |
|---|---|
| Backlog | — |
| Listo para tomar | — |
| **En curso** | **1 por persona** |
| **En revisión** | **3 en total** |
| Hecho | — |

El límite de "En curso" existe para evitar el patrón clásico: cuatro personas con
cinco tareas empezadas y ninguna terminada la semana del checkpoint. El de "En
revisión" fuerza a revisar los PRs de los demás antes de tomar trabajo nuevo.

## CI/CD

GitHub Actions, en cada push y cada PR:

1. Lint y formato
2. Typecheck
3. Tests unitarios
4. **Test de aislamiento multi-tenant** — intenta leer datos del club B con contexto
   del club A y espera cero filas. Bloqueante.
5. Build

En PR: preview deployment de Vercel. En merge a `main`: despliegue a producción.

Migraciones versionadas en el repo y aplicadas por el pipeline. Nunca a mano contra
la base de producción.

## Observabilidad

Lo que se instrumenta desde el Checkpoint 1, no al final:

- **Logs estructurados** con `club_id` en cada línea. **Nunca** datos personales,
  tokens de Mercado Pago ni contenido de archivos importados.
- **Errores** centralizados en Sentry, agrupados por módulo.
- **Métricas técnicas:** latencia p95, tasa de error, duración de los jobs.
- **Métricas de negocio:** tasa de cobranza del período, cargos emitidos vs. cobrados,
  webhooks recibidos vs. conciliados.
- **Métricas de IA:** ver [doc 09](09-ia-en-el-producto.md).
- **Health check** público con estado de base, cola y proveedor de pagos.

Sin esto no se puede responder "¿cómo saben que el sistema está sano?", que es una
pregunta segura en la defensa.

## Preparación de la defensa

La evaluación es individual y se centra en la **capacidad de defender las decisiones**.
Preguntas probables y dónde está la respuesta:

| Pregunta | Respuesta en |
|---|---|
| ¿Por qué Supabase y no RDS? ¿Por qué Vercel y no Lambda? | [05](05-arquitectura.md), sección Stack |
| ¿Cómo garantizan que un club no vea datos de otro? | [05](05-arquitectura.md), RLS + test en CI |
| ¿Qué pasa si Mercado Pago no envía el webhook? | [04](04-pagos-y-mercadopago.md), reconciliación |
| ¿Por qué no guardan el saldo del socio en una columna? | [02](02-glosario-y-dominio.md), el ledger |
| ¿La IA es un agregado o resuelve algo? | [09](09-ia-en-el-producto.md) |
| ¿Qué pasa si el proveedor de IA se cae? | [09](09-ia-en-el-producto.md), degradación al flujo manual |
| ¿Cómo controlan el costo de la IA? | [09](09-ia-en-el-producto.md), presupuesto por club |
| ¿Qué corrigieron de lo que propuso la IA? | [AI-DECISIONS.md](../AI-DECISIONS.md) |
| ¿Cómo escala si entran 200 clubes? | [05](05-arquitectura.md) |
| ¿Qué haría fracasar el producto? | [01](01-vision-y-negocio.md), riesgos |

**Ensayo obligatorio antes del 30/11:** cada integrante responde tres preguntas sobre
un módulo que **no** es el suyo. Si no puede, todavía no está listo.
