# AI Decision Log

Registro de auditoría del uso de asistentes de IA en el desarrollo de MiClub.
Requerido por la sección 3 del TPI (UTN FRLP — Desarrollo de Software Cloud, 2026).

> **No confundir con [`docs/09-ia-en-el-producto.md`](docs/09-ia-en-el-producto.md).**
> Ese documento describe la IA **dentro del producto**. Este audita la IA usada **para
> construirlo**. El TPI exige las dos cosas.

## Cómo se usa este log

Se agrega una entrada cuando un asistente de IA participa en una **decisión de diseño
o en código que llega a `main`**. No se registran autocompletados triviales.

Cada entrada lleva:

1. **Problema abordado** — el desafío técnico concreto.
2. **Prompt / Herramienta** — la instrucción enviada y el asistente empleado.
3. **Salida de la IA** — resumen de lo que propuso.
4. **Validación y corrección humana** — análisis crítico: qué se aceptó, qué se
   corrigió, qué alucinaciones, ineficiencias o riesgos de seguridad se detectaron.

Regla del equipo: **una entrada sin sección 4 escrita por una persona no cuenta.**
El valor del log está en la auditoría, no en el registro.

Convención de identificadores: `AID-NNN`, correlativo, nunca reutilizado.

---

## AID-001 · Documentación del dominio y modelo de datos

**Fecha:** 2026-08-25 · **Responsable:** Joaquín

**Problema abordado**
Estructurar el dominio de cobranza de cuotas antes de escribir código: cómo
representar deuda, pagos y estado de un socio sin construir algo que se rompa cuando
aparezcan grupos familiares, pagos parciales o correcciones del tesorero.

**Prompt / Herramienta**
Claude Opus 5 vía Claude Code. Pedido de documentar la idea del proyecto como contexto
y señalar qué era clave entender para poder llevarlo a cabo.

**Salida de la IA**
Propuso: (a) ledger inmutable de `cargos` + `pagos` + `aplicaciones_pago` en lugar de
un campo `saldo` mutable; (b) la **cuenta corriente** como unidad de facturación en
lugar del socio, para soportar grupos familiares; (c) historial de precios con
vigencia más congelamiento del monto en el cargo al emitir; (d) estado "al día /
moroso" como proyección derivada, no como campo editable.

**Validación y corrección humana**
- **Aceptado:** el ledger inmutable y los montos en enteros. Es práctica estándar en
  sistemas financieros y el argumento de auditabilidad se sostiene.
- **Aceptado con reserva:** la abstracción "cuenta corriente". Es la propuesta que la
  IA hizo con **más confianza y menos evidencia** — no había ningún dato real de club
  sobre la mesa. Se dejó marcada como decisión **D4** y se abrió el
  [doc 08](docs/08-descubrimiento-club.md) para validarla con clubes reales antes de
  implementarla.
- **Detectado:** las reglas de negocio que la IA listó (prorrateo, mora, cuota
  familiar, exenciones) estaban planteadas como si fueran conocidas. Se reescribieron
  explícitamente como checklist de **incógnitas a relevar**, para no codificar
  supuestos inventados.

---

## AID-002 · Decisión de arquitectura de pagos (D1)

**Fecha:** 2026-08-25 · **Responsable:** Joaquín

**Problema abordado**
Definir en qué cuenta de Mercado Pago cae el dinero del socio: cuenta propia con
liquidación posterior, o cuenta de cada club vía OAuth.

**Prompt / Herramienta**
Claude Opus 5 vía Claude Code, en el marco de la documentación de pagos.

**Salida de la IA**
Recomendó el modelo marketplace (cuenta del club vía OAuth), con el argumento de que
cobrar en cuenta propia constituye custodia de fondos de terceros, con las
obligaciones regulatorias asociadas.

**Validación y corrección humana**
- **Aceptado** como decisión D1, por el argumento comercial más que por el técnico:
  ningún tesorero entrega la recaudación del club a un tercero desconocido.
- **Corrección importante:** la IA dio por sentado que el modelo marketplace es
  compatible con el producto de suscripciones de Mercado Pago. **No lo verificó.** Si
  las suscripciones no admiten comisión de aplicación, se cae la combinación "débito
  automático + cobro por comisión", que es el núcleo del modelo de negocio. Se
  registró como investigación bloqueante **I1** en el
  [doc 06](docs/06-decisiones-abiertas.md) en vez de asumirlo.
- **Riesgo de seguridad detectado en la revisión:** el modelo OAuth implica almacenar
  `access_token` y `refresh_token` de terceros. Se agregó al doc 04 la exigencia de
  cifrado en reposo, rotación y manejo explícito del caso "token revocado".

**Lección registrada:** las recomendaciones de arquitectura que dependen de las
capacidades de una API externa se tratan como hipótesis hasta verificarlas en sandbox.

---

## AID-003 · Verificación de un requisito del enunciado

**Fecha:** 2026-08-25 · **Responsable:** Joaquín

**Problema abordado**
Determinar si el TPI exige integrar IA **dentro del producto** o solo permite
desarrollar **con** asistentes de IA. La diferencia cambiaba el alcance del proyecto.

**Prompt / Herramienta**
Claude Opus 5 vía Claude Code, sobre el PDF del enunciado.

**Salida de la IA**
Afirmó que la integración de IA en el producto era mandatoria y que faltaba por
completo en la documentación.

**Validación y corrección humana**
Se **cuestionó la afirmación** por considerarla una posible sobreinterpretación. Se
exigió la cita textual, que se verificó contra la sección 1 del enunciado: la
integración de servicios de IA figura como pilar mandatorio del proyecto, separada de
la sección 3, donde el uso de asistentes de desarrollo aparece como fomentado.
Confirmado: son dos requisitos distintos y ambos aplican.

**Lección registrada:** toda afirmación de la IA sobre el enunciado se acompaña de
cita a la sección correspondiente. El costo de verificar es bajo; el de construir
sobre un requisito mal leído, no.

---

## AID-004 · Selección del stack (D6)

**Fecha:** 2026-08-25 · **Responsable:** Joaquín

**Problema abordado**
Cerrar la elección de stack con justificación técnica, requisito explícito de
evaluación del TPI.

**Prompt / Herramienta**
Claude Opus 5 vía Claude Code. Pedido explícito de ventajas y desventajas de cada
alternativa antes de decidir.

**Salida de la IA**
Comparativo de Next.js + TypeScript, Rails y Django, encuadrado por la composición
real del MVP (~60% CRUD administrativo, ~30% motor de dinero, ~10% portal público).
Señaló como riesgo técnico principal, común a los tres, la combinación de Row Level
Security con pooling de conexiones.

**Validación y corrección humana**
- **Decisión tomada:** Next.js + Vercel + Supabase, por cobertura completa de la
  matriz de componentes del TPI con servicios gestionados.
- **Corrección de sesgo detectada:** la IA presentó inicialmente Next.js como stack
  propuesto sin haber evaluado alternativas. Recién ante el pedido explícito de
  trade-offs expuso que el 60% de CRUD administrativo es **más lento** en ese stack
  que en Rails o Django. Se aceptó igual, pero con el costo conocido en vez de oculto.
- **Aceptado y escalado:** la advertencia sobre RLS y pooling se incorporó al doc 05
  como riesgo técnico principal, con test de aislamiento multi-tenant en CI.

---

## AID-005 · Diseño de la capa de IA del producto

**Fecha:** 2026-08-25 · **Responsable:** Joaquín

**Problema abordado**
Definir qué funciones de IA integrar de modo que resuelvan dolores reales del negocio
y no queden como una demo agregada al costado.

**Prompt / Herramienta**
Claude Opus 5 vía Claude Code, con la restricción explícita de no proponer un chatbot.

**Salida de la IA**
Cuatro alternativas evaluadas. Se eligieron dos: importador inteligente de padrón y
conciliación semántica de pagos. Propuso que el LLM devuelva un **plan de mapeo**
estructurado en lugar de los datos transformados, y un esquema de conciliación en dos
fases (reglas baratas primero, LLM solo sobre una shortlist).

**Validación y corrección humana**
- **Aceptado:** el patrón "el LLM devuelve un plan, el código determinístico lo
  ejecuta". Elimina la posibilidad de alucinar datos de socios y hace el costo
  independiente del tamaño del archivo.
- **Descartada** la predicción de morosidad, pese a que la IA la presentó como
  atractiva: **un MVP nuevo no tiene historial con qué entrenar**. Habría exigido
  datos sintéticos, es decir una demo que no predice nada real.
- **Agregado por decisión humana:** el requisito de ofuscar identificadores en la
  muestra enviada al proveedor. La IA no lo había planteado, y el padrón de un club
  incluye datos de menores.
- **Agregado por decisión humana:** presupuesto de tokens por club y degradación al
  flujo manual. Sin eso, la IA sería un punto único de falla y un costo sin techo.

---

## Plantilla para nuevas entradas

```markdown
## AID-NNN · <título corto>

**Fecha:** AAAA-MM-DD · **Responsable:** <nombre>

**Problema abordado**
<qué se necesitaba resolver y por qué>

**Prompt / Herramienta**
<asistente empleado e instrucción enviada, resumida o textual>

**Salida de la IA**
<qué propuso, sin adornos>

**Validación y corrección humana**
- **Aceptado:** <qué y por qué>
- **Corregido:** <qué estaba mal: alucinación, ineficiencia, riesgo de seguridad>
- **Descartado:** <qué se rechazó y con qué argumento>
```
