# 07 — Roadmap

Cada fase termina con algo que un club real usa. No hay fases de "infraestructura".

> **Hay dos calendarios y no son el mismo.** El **académico** tiene fechas fijas y está
> en el [doc 10](10-entrega-academica.md). Este es el de **producto**. Lo que sigue
> muestra cómo se encajan: las fases 0 y 1 entran dentro del cuatrimestre; de la 1.5
> en adelante es vida después de la defensa.

| Fase de producto | Hito académico | Fecha |
|---|---|---|
| Fase 0 — Definición | Clase 1 · One-Pager | 24/08/2026 ✅ |
| Fase 1 — MVP, primera mitad | Checkpoint 1 · Arquitectura e infra | 28/09/2026 |
| Fase 1 — MVP, segunda mitad | Checkpoint 2 · Demo funcional | 09/11/2026 |
| Fase 1 — Cierre y endurecimiento | Defensa final · MVP en producción | 30/11/2026 |
| Fase 1.5 en adelante | — | post-defensa |

## Fase 0 — Definición ✅

- [x] Decidir D1 (dónde cae la plata), D6 (stack) y D12 (qué IA)
- [x] One-Pager
- [ ] Investigar I1, I2 e I3 (Mercado Pago en sandbox) — **sigue pendiente y bloquea D2**
- [ ] Conseguir 2–3 padrones reales en Excel
- [ ] Confirmar con un club real las reglas de negocio del final del doc 02

Los tres puntos abiertos no frenan el arranque de la Fase 1, pero **I1 condiciona el
modelo de negocio** y los padrones reales condicionan el diseño del importador.
Conviene resolverlos durante las primeras semanas, no al final.

## Fase 1 — MVP de cobranza

Alcance en el [doc 03](03-mvp.md), con el recorte por cronograma ya asumido ahí.
Orden sugerido; cada paso es construible y verificable por separado.

### Primera mitad — hasta el Checkpoint 1 (28/09)

1. Tenant + auth + club + roles, con **RLS y test de aislamiento en CI**
2. Socios, cuentas, categorías y precios con vigencia
3. Diagrama de arquitectura, infraestructura desplegada y pipeline en verde

### Segunda mitad — hasta el Checkpoint 2 (09/11)

4. **Importador inteligente (IA-1)** sobre un Excel real
5. Períodos y emisión idempotente de cargos
6. Cuenta corriente: cargos, pagos manuales, aplicación, saldo
7. Conexión OAuth de la cuenta de Mercado Pago del club
8. Link público de pago + Checkout Pro (sandbox)
9. Webhook con validación de firma + job de reconciliación
10. Pruebas de integración del flujo de cobro completo

### Cierre — hasta la defensa (30/11)

11. **Conciliación semántica (IA-2)**
12. Panel de morosos + generación de mensajes de WhatsApp
13. Observabilidad, presupuesto de IA, manejo de errores
14. Datos de demostración y ensayo de defensa

**Salida:** un club cobra el mes completo sin que toquemos nada a mano.

## Fase 1.5 — Débito automático

Suscripciones de Mercado Pago. Es la feature de mayor impacto en la métrica norte y el
argumento de renovación del SaaS. Queda fuera del cuatrimestre a propósito: depende de
I1 y agregaría riesgo al cronograma.

- Alta de la autorización por parte del socio
- Manejo de fallos de cobro y reintentos
- Baja y cambio de medio de pago
- Migración de los socios existentes al débito

## Fase 2 — Acceso y QR

Convierte la deuda en algo concreto: si debe, no entra. Multiplica el efecto de la Fase 1.

- Credencial digital del socio con QR firmado
- App/vista de portería con caché offline del padrón
- Registro de ingresos y reporte de asistencia
- Política de corte por deuda, configurable por club

## Fase 3 — Eventos

- Alta de evento con cupo y precio diferencial socio / no socio
- Venta de entradas con el mismo motor de cobro
- Acreditación en puerta reutilizando el lector de QR de la Fase 2

## Fase 4 — Escala de SaaS

Recién acá, y solo si hay clubes pagando:

- Autogestión del socio con login y comprobantes históricos
- Multi-club para un mismo administrador
- Reportes y exportaciones contables
- White-label (logo, colores, subdominio propio)
- Onboarding self-service, sin intervención nuestra

## Señales para no avanzar de fase

- Si el club de la Fase 1 vuelve al Excel para algo, falta cubrir eso: no avanzar.
- Si la tasa de cobranza no mejora contra la línea de base, el problema es el producto,
  no la falta de features.
- Si dar de alta un club nuevo requiere que nosotros metamos mano, todavía no es SaaS.
- Si nadie acepta las sugerencias de la IA, no es un diferenciador: es un costo.
