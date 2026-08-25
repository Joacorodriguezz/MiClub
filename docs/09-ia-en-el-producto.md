# 09 — IA en el producto

> Este documento cubre el tercer pilar del TPI: *"IA como Diferenciador de Negocio"*.
> No confundir con [`AI-DECISIONS.md`](../AI-DECISIONS.md), que audita el uso de
> asistentes de IA **para desarrollar**. Son dos cosas distintas y las dos son obligatorias.

## Criterio de selección

Descartamos deliberadamente el chatbot pegado al costado. Las dos funciones elegidas
atacan fricciones ya documentadas en los docs 01, 03 y 04, y **cada una decide si el
producto se adopta o no**:

| Función | Fricción que ataca | Documentada en |
|---|---|---|
| **IA-1 · Importador inteligente de padrón** | Barrera de adopción #1: migrar el Excel del club | docs 01 y 03 |
| **IA-2 · Conciliación semántica de pagos** | "Cuando entra una transferencia, ¿cómo sabés de quién es?" | doc 04 |

## Principio rector: la IA propone, el humano confirma

Regla del proyecto, sin excepciones:

> **Ningún socio entra al padrón, y ningún peso se aplica al ledger, por decisión
> autónoma de un modelo.** La IA produce una *propuesta* con score y justificación;
> una persona la acepta, la corrige o la rechaza.

Esto no es prudencia decorativa: choca de frente con la regla 1 del
[CLAUDE.md](../CLAUDE.md) (la plata es un ledger auditable). Un tesorero que ve un
pago aplicado a un socio equivocado *por una sugerencia automática* pierde la
confianza en el sistema entero, y esa confianza no se recupera.

---

## IA-1 — Importador inteligente de padrón

### El problema real

Cada club tiene su Excel y ninguno se parece al otro. Lo que llega de verdad:

- Encabezados arbitrarios: `Apellido y Nombre`, `SOCIO`, `Nº`, `Cat.`, `Tel/Cel`
- Nombre y apellido en una sola celda, con orden inconsistente
- DNI con puntos, con espacios, vacío, o con una nota (`"no tiene"`)
- Fechas en cinco formatos distintos dentro de la misma columna
- Categorías tipeadas a mano: `Activo`, `activo`, `ACTIVO`, `Act.`, `Activa`
- Filas que no son socios: subtotales, encabezados repetidos, notas al pie
- Varias hojas, y la buena no siempre es la primera

Sin IA, la solución es un wizard donde el tesorero mapea columna por columna.
Funciona, y es exactamente la fricción que hace que no migre.

### Diseño

```
Excel/CSV
   │
   ├─► Muestra estratificada (encabezados + 20 primeras filas + 10 al azar)
   │        │
   │        └─► LLM ──► PLAN DE MAPEO (JSON estructurado)
   │                      · columna → campo del schema, con confianza
   │                      · filas a descartar, con motivo
   │                      · reglas de normalización propuestas
   │                      · grupos familiares detectados
   │
   ├─► Código determinístico aplica el plan al archivo COMPLETO
   │
   └─► Pantalla de previsualización ──► confirmación humana ──► import
```

### Decisiones técnicas y por qué

**El LLM devuelve un plan, no los datos transformados.**
Le pedimos *cómo interpretar*, no que transcriba 2000 filas. La transformación la
ejecuta código determinístico y testeable. Con esto: no puede alucinar un DNI, el
costo es constante sin importar el tamaño del archivo, y el resultado es reproducible.

**Muestra, no archivo completo.**
Encabezados más ~30 filas alcanzan para inferir la estructura. Un archivo de 2000
socios y uno de 50 cuestan lo mismo.

**Salida estructurada obligatoria.**
Se usa tool use / structured output para garantizar JSON válido contra un esquema.
Nada de parsear texto libre.

**Detección de grupos familiares.**
Apellido compartido más teléfono o domicilio compartido más edades compatibles →
propuesta de agrupación en una cuenta. Es la función de mayor valor oculto: el doc 02
define la **cuenta** como unidad de cobro, y armar los grupos a mano es tedioso.
Siempre como sugerencia revisable.

**Minimización de datos personales.**
La muestra enviada al proveedor va con los identificadores ofuscados (DNI
enmascarado, teléfonos truncados): para inferir *estructura* no hace falta el dato
real. Relevante para la Ley 25.326 y para los datos de menores (ver doc 05).

### Criterio de aceptación

Importar un Excel real de un club, sin limpiarlo previamente, produce un padrón usable
con **cero mapeo manual de columnas** y un reporte legible de lo que descartó y por qué.

---

## IA-2 — Conciliación semántica de pagos

### El problema real

Entra una transferencia de $15.000 con la descripción `TRANSF DE J PEREZ` o
`MERCADOPAGO*JPEREZ`. Hay 40 socios que deben exactamente $15.000 y tres apellidos
Pérez en el padrón. Hoy el tesorero lo resuelve de memoria.

### Diseño: reglas primero, LLM después

```
Movimiento (texto, monto, fecha)
   │
   ├─► FASE 1 · Reglas baratas y determinísticas
   │     · alias ya confirmados antes  → match directo, sin LLM
   │     · monto exacto de deuda abierta
   │     · fuzzy matching de nombre
   │     └─► shortlist de hasta 5 candidatos
   │
   ├─► FASE 2 · LLM rankea y explica SOLO esa shortlist
   │     └─► cuenta sugerida + confianza + justificación en lenguaje natural
   │
   └─► FASE 3 · El tesorero confirma con un clic
         └─► la confirmación se guarda como alias conocido
             → la próxima vez matchea por regla, sin gastar un token
```

**Por qué en dos fases:** no se le pide al modelo que busque entre 2000 socios. Se le
dan 5 candidatos y se le pide criterio. Más barato, más rápido, más auditable, y con
un espacio de error acotado.

**El sistema aprende sin reentrenar nada.** Cada confirmación humana alimenta la tabla
`alias_pagador`. Con el uso, la proporción de casos que necesitan LLM baja sola.

**Nunca aplica solo.** La sugerencia se muestra con su justificación; la aplicación al
ledger es un acto humano. Cuando la confianza está por debajo del umbral, ni siquiera
se sugiere: se manda a revisión manual.

### Criterio de aceptación

Sobre un lote de movimientos reales, al menos el 80% de las sugerencias de alta
confianza son aceptadas por el tesorero sin corrección.

---

## Arquitectura cloud de la capa de IA

Las llamadas a un LLM son lentas, de latencia variable y pueden fallar. Eso obliga a
un diseño desacoplado, que es justamente lo que el TPI pide como pilar cloud-native.

| Aspecto | Decisión | Motivo |
|---|---|---|
| **Ejecución** | Asincrónica, como job en cola. Nunca dentro del request HTTP | Una función serverless con timeout no puede esperar a un LLM |
| **Cola** | Tabla de trabajos en Postgres + worker | Sin infraestructura extra; alcanza de sobra a esta escala |
| **Idempotencia** | Clave por hash del input | Reintentar un job no duplica costo ni resultados |
| **Caché** | Resultado cacheado por hash | Reprocesar el mismo archivo no vuelve a pagar |
| **Presupuesto** | Límite de tokens por club y por mes | El TPI pide soluciones *económicamente sostenibles*. Un import descontrolado no puede fundir el margen |
| **Degradación** | Si la IA falla, se agota el presupuesto o tarda de más, el flujo manual sigue disponible | **La IA mejora el flujo; no es punto único de falla.** Un club nunca queda sin poder importar ni conciliar |
| **Aislamiento** | Un único módulo `ia/` con la interfaz del proveedor | Mismo criterio que con Mercado Pago: cambiar de modelo o proveedor es un cambio contenido |

### Observabilidad de la IA

Métricas que se instrumentan desde el primer día, porque son las que se defienden:

- % de columnas mapeadas sin corrección humana
- % de sugerencias de conciliación aceptadas / corregidas / rechazadas
- Costo por importación y por conciliación, y acumulado por club
- Latencia p95 de cada tarea
- Tasa de caída al modo manual
- Tasa de respuestas que no validan contra el esquema

Sin estas métricas no se puede afirmar que la IA aporta valor: se puede opinar, nada más.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El modelo alucina datos de socios | Devuelve un plan, no datos. La transformación es determinística |
| Costo descontrolado en un import grande | Muestra de tamaño fijo + presupuesto por club |
| Datos personales enviados a un tercero | Ofuscación en la muestra, minimización, y declaración en los términos |
| Dependencia de un proveedor de IA | Interfaz propia en el módulo `ia/`, una sola implementación |
| Sugerencia de conciliación equivocada aplicada sin mirar | La confirmación humana es obligatoria; bajo el umbral de confianza no se sugiere |
| La IA queda como demo y no se usa | Las métricas de arriba en el panel: si nadie acepta las sugerencias, el dato aparece |
