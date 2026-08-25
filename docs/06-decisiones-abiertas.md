# 06 — Decisiones abiertas

Ordenadas por **costo de equivocarse**, no por urgencia.

**Decididas:** D1 (dónde cae la plata), D6 (stack), D12 (qué IA).
**En curso:** D3 (club de diseño).
**Abiertas:** D2, D4, D5, D7 a D11.

---

## D1 — ¿Dónde cae la plata? 🔴 bloqueante

**Opciones:** cuenta de MiClub (agregador) vs. cuenta de cada club (marketplace/OAuth).

**Recomendación: cuenta del club.** No custodiamos dinero de terceros, no somos PSP,
y ningún tesorero le confía la recaudación a un tercero desconocido.

**Impacto si se decide mal:** cambiar de agregador a marketplace después implica
rehacer la integración, el onboarding, los términos y el pricing. Ver doc 04.

**Estado: ✅ DECIDIDA (2026-08-25) — cuenta del club vía OAuth (marketplace).**
Consecuencias detalladas en el doc 04.

---

## D2 — ¿Cómo cobramos nosotros? 🔴 bloqueante

**Opciones:** % sobre lo cobrado · por socio activo/mes · tiers planos · híbrido.

**Trade-off central:** el % elimina la decisión de compra (si no cobrás, no pagás)
pero exige D1 = marketplace y hace el ingreso estacional. El abono fijo es predecible
pero es una barrera de entrada para clubes chicos.

**Depende de:** validar si las suscripciones de MP soportan comisión de aplicación
(doc 04, sección "Riesgo crítico").

**Estado:** sin decidir

---

## D3 — ¿Hay club de diseño? 🔴 bloqueante en la práctica

¿Tenés acceso a un club real que quiera usar esto y te deje ver su Excel y su
proceso de cobranza actual?

**Por qué importa más que cualquier decisión técnica:** las reglas de la sección
final del doc 02 (prorrateo, mora, cuota familiar, exenciones) no se pueden inventar.
Sin un club real, se construye un producto plausible que no le sirve a nadie.

**Riesgo del extremo opuesto:** con *un solo* club se construye un traje a medida
disfrazado de SaaS. Idealmente dos o tres clubes distintos, para poder separar lo
común de lo particular.

**Estado: 🟠 EN CURSO (2026-08-25)** — hay contactos, ninguno confirmado.
Siguiente paso: [08-descubrimiento-club.md](08-descubrimiento-club.md), la guía de
entrevista y el checklist de qué pedirles.

---

## D4 — ¿Cuenta corriente desde el día 1? 🟡 caro después

**Opciones:** facturar por socio (simple) vs. por cuenta con grupo familiar (correcto).

**Recomendación: cuenta desde el día 1.** El grupo familiar es la norma, no la
excepción, en clubes de barrio. Retrofitearlo implica migrar el ledger completo.
El costo hoy son dos tablas más; el costo después es una migración de datos financieros.

**Estado:** sin decidir

---

## D5 — Débito automático: ¿cuándo? 🟡

Es **la** feature que mueve la morosidad, y la razón por la que un club pagaría
un SaaS en vez de seguir con el Excel. Pero depende de D1, D2 y del riesgo de MP.

**Opciones:** en el MVP (riesgo de que bloquee el lanzamiento) · inmediatamente
después de validar el cobro simple (recomendado) · más adelante.

**Estado:** sin decidir

---

## D6 — Stack 🟢 reversible

Next.js + Vercel + Supabase vs. AWS (Lambda/RDS/Cognito) vs. Rails o Django en contenedores.

**Estado: ✅ DECIDIDA (2026-08-25) — Next.js (App Router) + TypeScript en Vercel,
con Supabase Postgres, Auth y Storage.** Se eligió por cobertura completa de la matriz
de componentes del TPI con servicios gestionados, aceptando el costo conocido de
escribir el CRUD administrativo a mano. Comparativo completo, matriz justificada y
alternativas descartadas en el [doc 05](05-arquitectura.md).

---

## D12 — ¿Qué IA integramos en el producto? 🔴 requisito del TPI

La integración de servicios de IA es un pilar mandatorio del enunciado (sección 1).
El criterio de selección fue rechazar el chatbot decorativo y elegir funciones que
resuelvan fricciones ya documentadas.

**Estado: ✅ DECIDIDA (2026-08-25)** — dos funciones:

- **IA-1 · Importador inteligente de padrón**, contra la barrera de adopción #1.
- **IA-2 · Conciliación semántica de pagos**, contra el problema de la transferencia
  sin referencia del doc 04.

**Descartada la predicción de morosidad**, pese a ser atractiva: un MVP nuevo no tiene
historial con qué entrenar y habría quedado como una demo que no predice nada real.

Diseño, arquitectura, costos y degradación en el [doc 09](09-ia-en-el-producto.md).

---

## D7 — Identidad del socio 🟡

¿Cuál es la clave natural de una persona en el padrón?

DNI es el candidato obvio, pero: los menores muchas veces no lo tienen cargado,
los Excel viejos lo tienen mal tipeado, y hay socios históricos sin el dato.

**Recomendación:** id interno como clave real; DNI como identificador *opcional*
con unicidad por club cuando está presente. Nunca como PK.

**Estado:** sin decidir

---

## D8 — Canal de notificación 🟡

WhatsApp es el único canal que la gente lee en Argentina. Pero la API oficial tiene
costo, verificación de negocio y plantillas que se aprueban.

**Recomendación:** MVP con links `wa.me` generados en lote (el admin dispara el envío).
Costo cero, sin dependencias, funciona el día 1. La API oficial cuando el volumen
lo justifique y haya ingresos.

**Estado:** sin decidir

---

## D9 — Comprobantes fiscales 🟡 investigar

¿Los clubes necesitan emitir factura AFIP/ARCA, o alcanza un recibo interno?

Muchas asociaciones civiles están exentas, pero **no todas**, y prometer lo que no
existe quema la venta. Requiere consultar con un contador y con clubes reales.

**Estado:** sin investigar

---

## D10 — Roles 🟢

¿Alcanza con `owner` + `admin`, o hace falta `tesorero` / `portero` / `solo lectura`?

**Recomendación:** dos roles en el MVP. `portero` aparece con el QR (fase 2) y ahí
se justifica solo. Agregar roles es barato; quitarlos, no.

**Estado:** sin decidir

---

## D11 — Subdominio por club 🟢 reversible

`club.miclub.app` vs. `miclub.app/club`.

El subdominio se ve más profesional y habilita white-label a futuro; el path es más
simple (sin DNS wildcard ni certificados). **Recomendación: path en el MVP.**

**Estado:** sin decidir

---

## Lo que hay que investigar antes de codear

| # | Pregunta | Bloquea |
|---|---|---|
| I1 | ¿Las suscripciones de MP soportan comisión de aplicación en modo marketplace? | D2, D5 |
| I2 | ¿Qué pide Mercado Pago para habilitar una aplicación en modo marketplace? | D1 |
| I3 | ¿Cómo son hoy la firma y la política de reintentos de los webhooks de MP? | Diseño del handler |
| I4 | ¿Qué software usan hoy los clubes de la zona y cuánto pagan? | D2, posicionamiento |
| I5 | ¿Necesitan comprobante fiscal? | D9 |
| I6 | Conseguir 2–3 Excel reales de padrón | Diseño del importador, doc 02 |
