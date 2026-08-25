# 01 — Visión y negocio

## El problema real

Un club de barrio con 300–2000 socios cobra la cuota así: el tesorero mantiene un
Excel, manda mensajes por WhatsApp uno por uno, recibe transferencias sin
referencia a un alias personal, anota a mano quién pagó, y persigue morosos de
memoria. El resultado típico:

- **Morosidad alta y silenciosa.** Nadie sabe cuántos deben ni desde cuándo hasta
  que el club se queda sin caja.
- **Cobranza tardía.** La plata entra el día 20 en vez del día 5.
- **Dependencia de una persona.** Si el tesorero se va, el conocimiento se va con él.
- **Cero trazabilidad.** Ante la comisión directiva no hay forma de auditar nada.

> El dolor no es "no tener un sistema de socios". El dolor es **plata que no entra**.
> Eso define todo el producto: cada feature se justifica por su impacto en cobrabilidad.

## Usuarios (son tres productos distintos, no uno)

| Rol | Quién es | Qué necesita | Frecuencia de uso |
|---|---|---|---|
| **Tesorero / Admin del club** | Voluntario, 50+ años, poco técnico, usa el celular | Ver quién debe, emitir el mes, mandar recordatorios, registrar un pago en efectivo | Semanal, intenso a fin de mes |
| **Socio** | Cualquiera, del pibe de 12 al vitalicio de 80 | Pagar en 2 clics sin crearse una cuenta. Saber qué debe | Mensual, 30 segundos |
| **Operador de portería** *(fase 2)* | Empleado o voluntario en la puerta | Escanear y que diga verde o rojo. Rápido, con mala señal | Diario, alto volumen |

El **admin** es quien compra. El **socio** es quien determina si funciona
(si la experiencia de pago tiene fricción, no paga y el producto fracasa aunque el
admin lo ame). El diseño se optimiza para el socio y se hace tolerante para el admin.

## Propuesta de valor

**Para el club:** cobrás más, antes y con menos trabajo.
**Para el socio:** pagás la cuota en 30 segundos desde el celular, sin ir al club.

Cómo se logra, en orden de impacto:

1. **Cobro automático recurrente** (débito autorizado por el socio). Es el único
   cambio que mueve la morosidad estructuralmente: elimina la decisión mensual.
2. **Link de pago personal** enviado por WhatsApp, sin login, sin app.
3. **Padrón vivo** con estado de deuda calculado, no anotado.
4. **Recordatorios automáticos** escalonados (antes de vencer, al vencer, a los 10 días).
5. **Consecuencia visible**: si debe, no entra (QR de acceso). Esto convierte
   la deuda de abstracta en concreta. Es el multiplicador de todo lo anterior.

Y dos funciones asistidas por IA que atacan las fricciones que hoy hacen fracasar la
adopción (detalle en el [doc 09](09-ia-en-el-producto.md)):

6. **Importador inteligente de padrón.** El Excel del club entra tal como está y sale
   convertido en un padrón usable. Ataca la barrera de adopción número uno.
7. **Conciliación semántica de pagos.** Ante una transferencia que dice `TRANSF JUAN P`,
   el sistema propone a qué socio corresponde, con score y justificación. Automatiza
   la tarea más tediosa y más propensa a error del tesorero.

En ambos casos la IA propone y una persona confirma: nada entra al padrón ni se aplica
al ledger por decisión autónoma de un modelo.

## Qué NO es

Definir esto evita el 80% del scope creep:

- **No es un ERP del club.** No lleva contabilidad, sueldos, ni inventario del buffet.
- **No es una red social ni una app de fans.** No hay feed, noticias ni chat.
- **No es un sistema deportivo.** No gestiona planteles, fixtures ni estadísticas.
- **No es una pasarela de pagos.** No custodia dinero de terceros (ver doc 04).
- **No es on-premise ni instalable.** Es web, multi-tenant, sin instalación.

## Métrica norte

**Tasa de cobranza del período**: `cargos del mes cobrados dentro de los 30 días / cargos emitidos`.

Secundarias: días promedio hasta el cobro, % de socios con débito automático activo,
% de cobranza por medio digital vs. manual.

Métricas que **no** importan: cantidad de usuarios registrados, sesiones, tiempo en la app.

## Competencia

El competidor real no es otro software: es **Excel + WhatsApp + alias de Mercado Pago**.
Es gratis, ya funciona "más o menos", y no requiere convencer a nadie. Todo el
producto se mide contra eso.

Categorías a relevar (pendiente: nombres concretos y precios del mercado argentino):

| Categoría | Fortaleza | Grieta que deja |
|---|---|---|
| Excel + WhatsApp | Gratis, cero fricción de adopción | No escala, no automatiza, no audita |
| Software de club legacy (desktop/instalado) | Completo, con años de features | Caro, pesado, feo, sin autogestión del socio |
| Herramientas genéricas de cobranza | Buen motor de pagos | No entienden el dominio (grupo familiar, categorías, portería) |
| SaaS horizontal de facturación | Prolijos y baratos | No modelan socios ni acceso físico |

**La grieta que atacamos:** el vertical específico (socios + cuota + acceso) con
experiencia de producto moderna y precio de club chico.

## Modelo de negocio

Ver doc 06 para la decisión abierta. Opciones sobre la mesa:

- **% sobre lo cobrado** (comisión de aplicación en cada pago). Alineado, sin
  decisión de compra ("si no cobrás, no pagás"), pero exige el modelo marketplace
  y hace el ingreso dependiente de la temporada del club.
- **Por socio activo / mes** con mínimo mensual. Predecible, fácil de explicar,
  penaliza al club que crece.
- **Tiers planos por rango de socios.** El más simple de vender, el menos alineado.

Restricción de contexto: los clubes chicos son **muy** sensibles al precio y pagan
con la caja del mes. Cualquier cobro fijo alto mata la venta.

## Riesgos del negocio

| Riesgo | Por qué duele | Mitigación |
|---|---|---|
| **Adopción del tesorero** | Si migrar el Excel cuesta, no migra | Importador CSV tolerante como feature de primera clase, no como "nice to have" |
| **Producto de estacionalidad** | Muchos clubes cobran fuerte solo parte del año | Precio que no castigue meses flojos |
| **Un solo club de diseño** | Se construye un traje a medida disfrazado de SaaS | Validar cada regla con al menos 2 clubes distintos antes de codearla |
| **Dependencia de Mercado Pago** | Cambios de API o de política rompen el core | Abstraer el proveedor de pagos detrás de una interfaz desde el día 1 |
| **Datos de menores** | Los clubes tienen cientos de chicos en el padrón | Ver doc 05, sección legal |
