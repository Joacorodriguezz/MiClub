# 05 — Arquitectura

## Multi-tenancy

Tres modelos posibles:

| Modelo | Aislamiento | Costo operativo | Cuándo conviene |
|---|---|---|---|
| **Base compartida + `club_id`** | Lógico | Muy bajo | Cientos/miles de tenants chicos ← **nuestro caso** |
| Schema por tenant | Medio | Medio, migraciones × N | Decenas de tenants grandes |
| Base por tenant | Fuerte | Alto | Requisito regulatorio o enterprise |

**Decisión: base compartida con `club_id` en toda tabla + Row Level Security en Postgres.**

El punto clave: **el aislamiento se hace cumplir en la base, no en el código**.
Un `WHERE club_id = ?` olvidado en un endpoint filtra datos de otro club. Una
política RLS mal escrita se testea una vez y protege todos los endpoints.

Regla operativa: existe un test automatizado que, para cada tabla, intenta leer
datos del club B con el contexto del club A y espera cero filas. Se corre en CI.

## Stack (D6 — decidido)

### Antes de elegir: de qué está hecho realmente el MVP

Aproximadamente:

- **~60% CRUD administrativo** — padrón, categorías, precios, filtros, buscadores,
  formularios, importador CSV. Poco glamoroso y es la mayor parte del trabajo.
- **~30% motor de dinero** — ledger, emisión de períodos, aplicación de pagos,
  webhooks, reconciliación, jobs programados.
- **~10% portal público de pago** — una sola pantalla, pero tiene que volar en un
  celular de gama baja con 3G. Es la que decide si el socio paga o abandona.

Elegí el stack que mejor resuelva ese 60% + 30%, no el que tenga el frontend más lindo.

### Opción 1 — Next.js (App Router) + TypeScript + Postgres

| | |
|---|---|
| ✅ | Un solo lenguaje y un solo deploy para panel, portal público y webhooks |
| ✅ | El portal de pago queda excelente: SSR, liviano, rápido en 3G. Es justo el 10% que define la conversión |
| ✅ | Vercel = cero devops |
| ✅ | Ecosistema enorme y mucha documentación de integración con Mercado Pago en JS |
| ❌ | **El 60% de CRUD se escribe a mano, pantalla por pantalla.** No hay scaffolding de admin: tablas, filtros, paginación y formularios, todo propio |
| ❌ | Jobs: los límites de tiempo de las funciones serverless pelean con "emitir 2000 cargos". Necesitás cron + cola en Postgres, o un servicio aparte |
| ❌ | **RLS + pooling de conexiones es fricción real.** Setear el contexto de tenant por request sin que un pooler en modo transacción lo filtre entre requests requiere cuidado |
| ❌ | No hay decimal nativo: disciplina propia y librería para el dinero |

### Opción 2 — Rails + Postgres

| | |
|---|---|
| ✅ | El mejor tooling para un dominio de ledger: migraciones, transacciones, ActiveRecord |
| ✅ | ActiveJob + Solid Queue resuelven emisión mensual, recordatorios y reconciliación de fábrica, sin pelear con timeouts |
| ✅ | Hotwire/Turbo: panel reactivo casi sin escribir JS. El 60% de CRUD sale bastante más rápido |
| ✅ | BigDecimal y librerías de dinero maduras |
| ✅ | Deploy con Kamal a un VPS barato, sin vendor lock-in |
| ❌ | Necesitás un servidor y algo de devops. Poco, pero no cero como Vercel |
| ❌ | Menos ejemplos de integración con Mercado Pago en Ruby que en JS |
| ❌ | Si no sabés Ruby, la curva es real y el MVP es lo peor para aprender un lenguaje |

### Opción 3 — Django + Postgres

| | |
|---|---|
| ✅ | **Django Admin te da un panel interno gratis** desde el día 1: para cargar datos, dar soporte y depurar, es enorme |
| ✅ | ORM y migraciones sólidas; `Decimal` nativo bien resuelto |
| ✅ | Celery para jobs; Python fácil de leer y de contratar |
| ❌ | **Matiz importante: Django Admin no es el producto.** Sirve para vos, no para dárselo a un tesorero de 60 años. El panel que vende hay que construirlo igual |
| ❌ | El frontend público se resuelve aparte (templates + HTMX, o un SPA) |
| ❌ | Webhooks y async funcionan bien, pero menos naturales que en Node |

### Innegociable, elijas lo que elijas

- **Postgres.** Por RLS y por transacciones serias. No es negociable.
- **Montos en enteros** y un único módulo de dinero.
- **Mercado Pago detrás de una interfaz**, en un solo módulo.
- **Test de aislamiento multi-tenant en CI.**

### El riesgo técnico real no es el stack

Es **RLS + pooling de conexiones**. Los tres pueden filtrar datos entre clubes si el
contexto de tenant se setea mal o se reusa una conexión sucia. Presupuestá tiempo
para resolver eso bien, sea cual sea la elección.

### Decisión (2026-08-25): Next.js + Vercel + Supabase

Se eligió la **Opción 1**. El criterio decisivo no fue la ergonomía de desarrollo
—donde Rails habría sido más rápido para el 60% de CRUD— sino la **cobertura completa
de la matriz de componentes del TPI con servicios gestionados**, sin trabajo de
infraestructura que compita con el tiempo de producto en un cuatrimestre.

El costo se asume con los ojos abiertos: el CRUD administrativo se escribe a mano. Se
mitiga con una librería de tablas y componentes de ABM reutilizables, no ignorándolo.

| Componente (matriz del TPI) | Elección | Justificación |
|---|---|---|
| **Frontend PaaS** | Next.js (App Router) + TypeScript en Vercel | SSR y CDN global: el portal de pago del socio tiene que cargar en un celular de gama baja con 3G. Es la pantalla que decide si el socio paga |
| **Backend / API** | Route Handlers + Vercel Functions (serverless) | La carga es estacional y con picos marcados. Escala a cero fuera de los primeros días del mes |
| **Persistencia** | Supabase Postgres (gestionado) | RLS nativo para el aislamiento multi-tenant en la base, y transacciones serias para el ledger. Ninguna base NoSQL da lo segundo |
| **Storage / CDN** | Supabase Storage + CDN de Vercel | Comprobantes, logos y archivos de importación |
| **Autenticación** | Supabase Auth | Gestionado, integrado con RLS vía JWT. Solo administradores; el socio nunca se loguea |
| **Jobs asincrónicos** | Cola en Postgres + Vercel Cron | Emisión mensual, recordatorios, reconciliación y tareas de IA. Sin Redis: a esta escala no se justifica |
| **IA** | Claude API con salida estructurada | Importador inteligente y conciliación semántica. Ver [doc 09](09-ia-en-el-producto.md) |
| **Pagos** | Mercado Pago en modo marketplace (OAuth) | La plata cae en la cuenta de cada club. Ver [doc 04](04-pagos-y-mercadopago.md) |
| **Observabilidad** | Sentry + logs estructurados con `club_id` | Trazabilidad por tenant de cada operación de dinero |
| **CI/CD** | GitHub Actions + Preview Deployments | Validación automática y despliegue continuo |

### Alternativas evaluadas y descartadas

**AWS (Lambda + RDS + Cognito + S3/CloudFront).** Es la referencia canónica del
enunciado y luce más "cloud" en una defensa. Se descartó por **costo de oportunidad,
no por capacidad**: la plomería (VPC, IAM, API Gateway, IaC) consume semanas que el
cronograma no tiene, y no aporta nada al problema de negocio. La misma arquitectura
lógica es portable a AWS si el producto lo justificara.

**Rails o Django en contenedores.** Mejor ergonomía para el 60% de CRUD y mejor
tooling para un dominio de ledger. Se descartó porque obliga a gestionar servidor,
escalado y despliegue, lo que choca con el pilar de servicios gestionados del TPI.

## Arquitectura cloud-native

Los tres pilares que pide el enunciado, y cómo se materializan acá:

### Elasticidad

La carga de MiClub es **estacional y con picos agudos**, no constante:

- Días 1 a 10 del mes: emisión de cargos y avalancha de pagos.
- Minutos posteriores a un envío masivo de recordatorios por WhatsApp: cientos de
  socios abriendo su link de pago casi al mismo tiempo.
- Resto del mes: tráfico casi nulo.

Serverless resuelve exactamente ese perfil: escala con el pico y escala a cero
después. Un servidor dimensionado para el pico estaría ocioso el 80% del mes.

### Desacoplamiento

Nada lento ocurre dentro de un request HTTP:

| Trabajo | Por qué va desacoplado |
|---|---|
| Webhooks de Mercado Pago | Se responde 200 y se encola. Si tardamos, MP reintenta y multiplica el problema |
| Emisión de un período | Miles de cargos: excede el timeout de una función |
| Tareas de IA | Latencia variable de un LLM. Ver [doc 09](09-ia-en-el-producto.md) |
| Reconciliación | Job periódico contra la API de MP |
| Recordatorios | Procesamiento en lote |

A nivel de código, el mismo criterio: Mercado Pago vive solo en `pagos-mp/` y el
proveedor de IA solo en `ia/`, ambos detrás de una interfaz propia.

### Alta disponibilidad y degradación

Cada dependencia externa tiene una salida documentada. Esto es lo que convierte
"resiliencia" en algo demostrable:

| Si se cae… | Qué pasa | Degradación |
|---|---|---|
| El proveedor de IA | No hay mapeo asistido ni sugerencias de conciliación | El wizard manual de importación y la asignación manual de pagos siguen disponibles. **La IA no es punto único de falla** |
| Mercado Pago | No se puede cobrar en línea | El club sigue registrando pagos en efectivo y transferencia. El padrón y el ledger funcionan |
| Un webhook nunca llega | El pago no se refleja al instante | El job de reconciliación lo detecta y lo aplica |
| Se agota el presupuesto de IA de un club | No hay sugerencias | Caída automática al flujo manual, con aviso |
| La base | Caída total | Backups gestionados y point-in-time recovery de Supabase |

### Costos

El TPI pide soluciones *económicamente sostenibles*. Los tres costos que escalan con
el uso y cómo se acotan:

- **IA:** presupuesto de tokens por club y por mes, muestra de tamaño fijo y caché por
  hash. Un import de 2000 socios cuesta lo mismo que uno de 50.
- **Serverless:** escala a cero. El costo sigue a la estacionalidad del negocio.
- **Base:** una instancia compartida para todos los tenants. El modelo de base
  compartida con RLS es también la decisión más barata.

## Estructura por dominio, no por capa técnica

```
src/
  socios/          modelo, casos de uso, UI
  cuotas/          emisión, cargos, períodos
  cobranza/        intenciones de pago, aplicación, reconciliación
  pagos-mp/        adaptador de Mercado Pago (único lugar que conoce la API)
  ia/              importador inteligente y conciliación semántica
  clubes/          tenant, configuración, roles
  compartido/      dinero, fechas, auditoría, errores
```

Regla: `pagos-mp/` es el **único** módulo que importa el SDK de Mercado Pago, e `ia/`
el único que conoce al proveedor de IA. El resto del sistema habla con interfaces
propias (`ProveedorDePagos`, `AsistenteImportacion`). Es lo que permite que un cambio
de API externa sea un incidente contenido y no una reescritura.

Esta separación tiene además una función académica: cada carpeta es el territorio de
un módulo con dueño, lo que hace legible la contribución individual en el historial de
Git. Ver [doc 10](10-entrega-academica.md).

## Dinero

- Tipo `bigint` en centavos. Nunca `float`, nunca `decimal` de JS.
- Todo monto va acompañado de moneda explícita, aunque hoy siempre sea `ARS`.
- Un solo módulo `compartido/dinero` con las operaciones permitidas. Prohibido
  sumar montos con `+` fuera de ahí.
- Redondeo definido una vez y documentado (prorrateos y descuentos generan centavos partidos).

## Fechas

- Todo se guarda en UTC, todo se muestra e interpreta en `America/Argentina/Buenos_Aires`.
- Un "período" es `(anio, mes)`, no un rango de timestamps.
- Un vencimiento es una **fecha**, no un instante: vence al final del día local.

## Seguridad

| Superficie | Riesgo | Control |
|---|---|---|
| Tokens de MP de cada club | Acceso total a su cuenta de cobro | Cifrado en reposo con clave gestionada, jamás en logs, rotación de refresh token |
| Link de pago público | Enumerable → exponés el padrón | Token opaco aleatorio (no id secuencial), expirable, sin datos personales en la URL |
| Panel admin | Toma de cuenta del tesorero | 2FA disponible; obligatorio para el rol `owner` |
| Import CSV | Inyección de fórmulas, PII en logs | Sanitizar, no loguear contenido de filas |
| Webhooks | Falsificación de pagos | Validación de firma obligatoria; sin firma válida, descarte |
| Multi-tenant | Fuga entre clubes | RLS + test de aislamiento en CI |

## Legal y datos personales

No es opcional y conviene resolverlo antes de tener clientes, no después:

- **Ley 25.326 de Protección de Datos Personales** (Argentina). Aplican derechos
  de acceso, rectificación y supresión sobre el padrón.
- **Datos de menores.** Los clubes tienen cientos de chicos. Consentimiento del
  responsable, y minimización: no pedir lo que no se usa. Definir explícitamente
  qué campos guardamos de un menor.
- **Rol de tratamiento.** El club es el responsable de los datos; MiClub es
  encargado del tratamiento. Eso debe estar en los términos y en un contrato con cada club.
- **Portabilidad y salida.** Exportación completa del padrón y del ledger en CSV,
  siempre disponible. Además de ser correcto, es un argumento de venta: "no quedás preso".
- **Comprobantes.** Definir si el club necesita factura AFIP/ARCA o alcanza un
  recibo interno. Muchas asociaciones civiles están exentas, pero hay que confirmarlo
  caso por caso antes de prometer nada.

## Cómo se agrega el QR sin rehacer nada (fase 2)

Se documenta ahora porque condiciona una sola decisión temprana: **el estado de
deuda tiene que ser consultable como proyección barata**.

Dos QR distintos, no confundirlos:
- **QR de credencial** (identidad del socio, para portería).
- **QR de pago** (lo genera Mercado Pago, no nosotros).

Para la credencial, la tensión real es *offline vs. seguridad*:

| Enfoque | Ventaja | Problema |
|---|---|---|
| QR estático con id del socio | Simple, imprimible en un carnet | Falsificable y compartible: se saca foto y entra cualquiera |
| QR dinámico firmado y rotativo en el celular | No falsificable | Requiere que el socio tenga la app/link abierto y señal |
| QR estático + token firmado + padrón sincronizado en el lector | Funciona sin señal en la puerta | Necesita app de portería con caché y sincronización |

Recomendación preliminar: **token firmado (HMAC) con expiración larga + caché local
del padrón en el dispositivo de portería**. La señal en la puerta de un club siempre
es mala; un lector que depende de internet no se usa dos veces.
