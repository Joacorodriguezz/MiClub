# 04 — Pagos y Mercado Pago

> **Este es el documento más importante del proyecto.** La decisión de cómo fluye la
> plata condiciona el modelo de negocio, el marco legal, la arquitectura y hasta el
> pricing. Equivocarse acá no se corrige refactorizando.
>
> Todo detalle de API acá es orientativo: **verificar contra `developers.mercadopago.com.ar`
> al momento de implementar**, porque cambian nombres de campos y políticas.

## La pregunta que hay que responder primero

**¿En qué cuenta cae la plata del socio?**

### Opción A — Cuenta de MiClub (agregador)

El socio paga a nuestra cuenta, nosotros liquidamos al club después.

- ✅ Integración trivial: una sola credencial, onboarding sin fricción.
- ❌ **Custodiamos dinero de terceros.** Eso nos convierte de facto en un PSP:
  obligaciones regulatorias (BCRA), cuentas de recaudación, prevención de lavado,
  y responsabilidad si algo sale mal.
- ❌ Nosotros cargamos con contracargos y devoluciones.
- ❌ El club depende de nuestra solvencia y de nuestro calendario de liquidación.
  Un club no le confía su caja a una startup desconocida.
- ❌ Riesgo de cierre de cuenta por parte de MP al detectar operatoria de agregación.

### Opción B — Cuenta del club (marketplace / OAuth) ← **ELEGIDA**

Cada club conecta **su propia** cuenta de Mercado Pago vía OAuth. La plata cae
directo en la cuenta del club. Nosotros iniciamos cobros en su nombre y,
opcionalmente, retenemos una comisión de aplicación por transacción.

- ✅ **Nunca tocamos plata ajena.** No somos PSP. Riesgo regulatorio ≈ 0.
- ✅ El club ve su plata en su propia cuenta, al instante. Argumento de venta enorme.
- ✅ Contracargos y devoluciones son entre MP y el club.
- ✅ Habilita el pricing por comisión sobre lo cobrado.
- ⚠️ Onboarding más largo: el club necesita cuenta de MP y hacer el OAuth.
- ⚠️ Manejamos `access_token` / `refresh_token` de terceros → **cifrado en reposo
  obligatorio** y rotación. Es la joya que hay que custodiar.
- ⚠️ Hay que verificar qué productos de MP soportan comisión de aplicación
  (ver "Riesgo crítico" abajo).

**Decisión tomada (2026-08-25): Opción B — la plata cae en la cuenta del club.**
El argumento decisivo no es técnico: ningún tesorero le entrega la recaudación del
club a un tercero desconocido.

Consecuencias que quedan fijadas a partir de acá:

- El onboarding de un club **incluye conectar su cuenta de Mercado Pago por OAuth**.
  Sin eso, el club no puede cobrar. Es el paso más frágil del alta y hay que diseñarlo
  con cuidado (qué pasa si el tesorero no tiene cuenta, si no es el titular, si revoca el acceso).
- Existe la tabla `integraciones_pago` con `access_token` y `refresh_token` **cifrados
  en reposo**, con rotación. Es el activo más sensible del sistema.
- Hay que manejar el caso "token revocado o vencido": el club deja de poder cobrar
  y necesita un aviso claro, no un error 500.
- No custodiamos fondos: contracargos, devoluciones y liquidación son entre MP y el club.
- Habilita cobrar por comisión de aplicación (D2), **sujeto a validar I1**.

## Productos de Mercado Pago relevantes

| Producto | Para qué sirve acá | Cuándo |
|---|---|---|
| **Checkout Pro** | Link/preferencia de pago hosteado por MP. El socio paga con tarjeta, dinero en cuenta, transferencia. Cero PCI para nosotros. | **MVP.** Es el camino más corto a cobrar de verdad. |
| **Suscripciones (preapproval)** | Débito recurrente autorizado una vez por el socio. Elimina la decisión mensual. | **Fase 1.5.** Es la feature de mayor impacto en morosidad. |
| **Checkout API / Bricks** | Formulario de pago embebido, sin salir de nuestro dominio. | Después, solo si la fricción del redirect resulta medible. |
| **QR / Point** | Cobro presencial en la sede. | Fase 2, junto con portería. |

## Riesgo crítico a validar antes de comprometer el pricing

**¿Las suscripciones (preapproval) de Mercado Pago soportan comisión de aplicación
en modo marketplace?**

Si la respuesta es **no**, se rompe la combinación "débito automático + cobro por
comisión", que es justamente el corazón del producto y del negocio a la vez.

Plan si no se puede:
- Cobrar la suscripción de MiClub al club por separado (abono, no comisión), o
- Usar comisión solo en pagos de Checkout Pro y abono fijo para los recurrentes.

**Acción: validar esto en sandbox antes de escribir una línea de código de cobranza.**
Es la única investigación que bloquea decisiones de negocio.

## Flujo de cobro (MVP)

```
1. Emisión           → cargos pendientes en la cuenta corriente
2. Link de pago      → se crea una preferencia en la cuenta MP del club
                       external_reference = id de nuestra intención de pago
3. Socio paga        → en el checkout de MP, sin registrarse en MiClub
4. Webhook           → MP notifica; validamos firma; encolamos
5. Consulta          → NO confiamos en el payload: consultamos el pago a la API de MP
6. Aplicación        → pago aprobado → se aplica a cargos (más viejo primero)
7. Proyección        → se recalcula el estado de la cuenta
8. Reconciliación    → job periódico que busca pagos que nunca notificaron
```

### Reglas del handler de webhooks

Los webhooks llegan **duplicados, desordenados, tarde, o nunca**. El diseño lo asume:

1. **Validar la firma** de la notificación antes de procesar. Sin firma válida, se descarta.
2. **Registrar y deduplicar**: tabla `eventos_webhook` con unique sobre el id del
   evento. Si ya existe, responder 200 y salir.
3. **Responder 200 rápido**, procesar asincrónicamente. Si tardamos, MP reintenta
   y multiplicamos el problema.
4. **El payload no es la verdad.** Trae un id; el estado se consulta a la API.
5. **Idempotencia en la aplicación del pago**, no solo en la recepción del evento:
   unique sobre `(club_id, referencia_externa_mp)` en `pagos`.
6. **Nunca procesar fuera de orden destructivamente.** Un `approved` seguido de un
   `refunded` viejo no puede revertir el estado.

### Reconciliación

Sin esto el sistema pierde plata en silencio. Job diario que:
- consulta a MP los pagos del club en las últimas 72 h,
- compara contra nuestros `pagos`,
- crea los faltantes y marca las discrepancias para revisión humana.

Ningún ajuste automático destructivo: las diferencias se reportan, no se "arreglan".

## Intención de pago

Entre "el socio quiere pagar" y "el pago existe" hay un estado intermedio que
conviene modelar explícitamente:

```
intencion_pago
  id, club_id, cuenta_id
  cargos_incluidos[]        ← qué se está pagando
  monto_total               ← congelado al crearse
  preferencia_mp_id
  estado: creada | pagada | expirada | cancelada
```

Sirve para: saber qué cargos cubre un pago cuando vuelve el webhook, reusar links
vigentes en vez de crear una preferencia por clic, y auditar intentos fallidos
(un socio que intenta pagar tres veces y no puede es una señal de bug, no de morosidad).

## Pagos que no pasan por Mercado Pago

**Esto no es opcional.** Todo club cobra efectivo y transferencias directas.
Si el sistema solo entiende MP, el tesorero mantiene un Excel paralelo y el
producto pierde su única razón de existir: ser la fuente de verdad.

- Registro manual con: medio (`efectivo` / `transferencia` / `otro`), fecha real,
  monto, observación, y **quién lo registró**.
- Constancia/recibo descargable con número correlativo por club.
- Los pagos manuales son tan inmutables como los digitales: se revierten con
  contraasiento, no con `DELETE`.

## Errores clásicos a evitar

| Error | Consecuencia |
|---|---|
| Guardar montos en float | Descuadres de centavos que nadie puede explicar |
| Confiar en el estado que trae el webhook | Pagos fantasma, fraude trivial |
| No guardar `external_reference` | Imposible saber qué cargo pagó ese pago |
| Crear una preferencia nueva por cada clic | Links viejos que cobran de más, duplicados |
| Aplicar el pago dentro del handler HTTP | Timeouts, reintentos, pagos duplicados |
| Asumir que el que paga es el socio | Paga el padre, la abuela, el vecino. El pagador ≠ el socio |
| Tokens de MP en texto plano | Acceso total a la cuenta de cobro de cada club |
| No manejar devoluciones/contracargos | El estado dice "al día" y la plata volvió |
