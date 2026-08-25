# MiClub — One-Pager

**Trabajo Práctico Integrador — Ingeniería de Software en la Nube**
UTN FRLP · Departamento de Ingeniería en Sistemas de Información · Ciclo lectivo 2026
Hito: Clase 1 · Equipo: 3–4 integrantes

---

## Nombre del proyecto

**MiClub** — SaaS de gestión de socios y cobranza de cuotas para clubes.

## El problema

Un club de barrio con 300 a 2000 socios cobra la cuota con un Excel, mensajes de
WhatsApp uno por uno y transferencias sin referencia a un alias personal. El
resultado es siempre el mismo: **morosidad alta que nadie mide, cobranza tardía,
y todo el conocimiento en la cabeza de una sola persona**. Cuando el tesorero
renuncia, el club pierde su padrón y su historial de cobranza.

El dolor no es "no tener un sistema de socios". El dolor es **plata que no entra**.

## Propuesta de valor

**Para el club:** cobrás más, antes y con menos trabajo.
**Para el socio:** pagás la cuota en 30 segundos desde el celular, sin instalar nada
ni crearte una cuenta.

Cómo se logra:

1. **Padrón vivo** con estado de deuda calculado sobre un ledger auditable, no anotado a mano.
2. **Link de pago personal** por Mercado Pago, sin login, enviado por WhatsApp.
3. **Cobro recurrente automático** que elimina la decisión mensual del socio.
4. **Migración en 5 minutos**: el importador inteligente lee el Excel del club tal
   como está y lo convierte en un padrón usable.
5. **Consecuencia visible** (fase 2): si debe, no entra. Control de acceso por QR.

## Diferenciador con IA

La IA no es un agregado: ataca las dos fricciones que hoy hacen fracasar la adopción.

| Función | Qué resuelve |
|---|---|
| **Importador inteligente de padrón** | Un LLM interpreta el Excel real del club —columnas con nombres arbitrarios, nombre y apellido en una celda, DNI mal tipeado, fechas en cinco formatos, categorías con typos— y propone el mapeo, la normalización y los grupos familiares detectados. Convierte 2 horas de carga manual en 5 minutos con confirmación humana. |
| **Conciliación semántica de pagos** | Ante una transferencia que dice `TRANSF JUAN P` por $15.000, el sistema propone a qué socio corresponde con score y justificación, combinando reglas baratas con ranking por LLM. Automatiza la decisión más tediosa y más propensa a error del tesorero. |

En ambos casos la IA **propone y el humano confirma**: ningún dato entra al padrón
ni se aplica un peso al ledger sin decisión de una persona.

## Usuarios objetivo

| Rol | Quién es | Qué hace en el sistema |
|---|---|---|
| **Tesorero / Admin** | Voluntario del club, poco técnico, usa el celular. Es quien compra. | Emite el mes, revisa morosos, registra pagos en efectivo, envía recordatorios |
| **Socio** | Cualquiera, de 12 a 80 años. Determina si el producto funciona. | Abre un link, ve qué debe, paga. Sin login |
| **Operador de portería** *(fase 2)* | Empleado o voluntario en la puerta | Escanea un QR y ve verde o rojo |

**Mercado inicial:** clubes de barrio y asociaciones civiles de La Plata y Gran
Buenos Aires, de 200 a 1500 socios. Multi-tenant desde el día uno.

## Stack tentativo

| Componente | Elección | Justificación |
|---|---|---|
| **Frontend** | Next.js (App Router) + TypeScript en **Vercel** | PaaS con CDN global y SSR: el portal de pago del socio debe cargar rápido en un celular de gama baja con 3G |
| **Backend / API** | Route Handlers + **Vercel Functions** (serverless) | Carga muy estacional (picos los primeros días del mes). Escala a cero el resto |
| **Persistencia** | **Supabase Postgres** (gestionado) | Multi-tenancy con **Row Level Security** en la base, no en el código. Transacciones serias para el ledger |
| **Autenticación** | **Supabase Auth** | Servicio gestionado. Solo los administradores se loguean; el socio nunca |
| **Storage / CDN** | Supabase Storage + CDN de Vercel | Comprobantes, logos y archivos de importación |
| **Jobs asincrónicos** | Cola en Postgres + Vercel Cron | Emisión mensual, recordatorios, reconciliación con Mercado Pago y tareas de IA |
| **IA** | **Claude API** (Anthropic) con salida estructurada | Importación inteligente y conciliación semántica, con límite de costo por club |
| **Pagos** | **Mercado Pago** en modo marketplace (OAuth) | La plata cae en la cuenta de cada club: no custodiamos fondos de terceros |
| **Observabilidad** | Sentry + logs estructurados con `club_id` | Trazabilidad por tenant de cada operación de dinero |
| **CI/CD** | GitHub Actions + Preview Deployments de Vercel | Validación automática y despliegue continuo |

La justificación ampliada de cada componente, con las alternativas evaluadas y sus
trade-offs, está en [`docs/05-arquitectura.md`](docs/05-arquitectura.md).

## Decisión de arquitectura más relevante tomada hasta ahora

**La plata cae en la cuenta de Mercado Pago de cada club, conectada por OAuth.**
La alternativa —cobrar en una cuenta propia y liquidar después— era mucho más simple
de integrar, pero nos convertía de hecho en un proveedor de servicios de pago:
custodia de fondos de terceros, obligaciones regulatorias y responsabilidad por
contracargos. El análisis completo está en
[`docs/04-pagos-y-mercadopago.md`](docs/04-pagos-y-mercadopago.md).
