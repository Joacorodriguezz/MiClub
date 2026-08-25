# 02 — Glosario y modelo de dominio

Este documento es la fuente de verdad del vocabulario. Si el código usa una palabra
que no está acá, o la usa con otro sentido, el código está mal.

## Glosario

| Término | Definición precisa | Confusión frecuente |
|---|---|---|
| **Club** | El tenant. Toda fila del sistema pertenece a uno. | — |
| **Socio** | Persona física con vínculo asociativo al club. | No es un usuario del sistema. La mayoría de los socios nunca se loguea. |
| **Usuario** | Cuenta con credenciales que opera el sistema. | Un usuario puede administrar varios clubes. Un socio puede no tener usuario. |
| **Categoría** | Clasificación que determina el precio (activo, cadete, vitalicio, adherente, jubilado). | El precio **no** vive en la categoría, vive en el historial de precios. |
| **Cuenta corriente** | Unidad de facturación. Contra ella se emiten cargos y se aplican pagos. | **No es lo mismo que socio.** Un grupo familiar es una sola cuenta con varios socios. |
| **Período** | Mes de devengamiento (`2026-08`). Tiene estado propio. | No es "la fecha del pago". |
| **Cargo** | Deuda generada: qué se debe, por qué, cuándo vence. Inmutable. | ≠ cuota. La cuota mensual es *un tipo* de cargo. |
| **Cuota** | El cargo recurrente mensual por ser socio. | Coloquialmente la gente dice "cuota" a todo cargo. En el código, no. |
| **Pago** | Dinero efectivamente recibido. Inmutable. | Un pago puede no estar asignado a ningún cargo todavía. |
| **Aplicación** | Vínculo pago ↔ cargo por un monto. Permite pagos parciales y pagos que cubren varios cargos. | — |
| **Saldo a favor** | Pago recibido sin cargo al cual aplicarlo. | No es un cargo negativo. |
| **Emisión** | Acto de generar los cargos de un período para todas las cuentas activas. | Es un evento con fecha y responsable, no un cron invisible. |
| **Mora** | Estado de una cuenta con cargos vencidos e impagos. | El **recargo** por mora es un cargo aparte, no una modificación del cargo original. |
| **Bonificación** | Reducción autorizada del monto a pagar. Se registra como cargo negativo. | No se edita el cargo original. |
| **Baja** | Fin del vínculo asociativo. Deja de generar cargos. | No borra al socio ni su historia. |

## Las cuatro sutilezas que definen el modelo

Cada una parece un detalle y en realidad es una decisión de arquitectura:

### 1. La unidad de cobro es la cuenta, no el socio

Los clubes cobran **por grupo familiar**: el padre paga una cuota que cubre a tres
hijos, y quiere un solo link, un solo recordatorio y un solo comprobante. Si el
modelo emite cargos por socio y sumás después, todo lo demás (notificaciones,
links de pago, estado de deuda, débito automático) se te complica en cascada.

```
cuenta (1) ──< socio (N)     ← la cuenta tiene un titular/pagador
cuenta (1) ──< cargo (N)
cuenta (1) ──< pago  (N)
```

Un socio individual = una cuenta con un solo socio. Modelo uniforme, sin casos especiales.

> **Costo de no hacerlo desde el día 1:** retrofitear "grupo familiar" sobre un
> sistema que factura por socio implica migrar el ledger entero. Es de las pocas
> cosas que conviene sobre-diseñar al principio.

### 2. Los precios tienen historia, y el cargo guarda una foto

En Argentina la cuota cambia varias veces al año. Se necesitan **las dos cosas**:

- `precios_categoria (categoria_id, monto, vigente_desde)` — para saber qué cobrar al emitir.
- `cargo.monto` congelado al momento de la emisión — para que un cargo de marzo
  siga diciendo lo que decía en marzo, aunque el precio haya cambiado cinco veces.

Un `cargo` que lee el precio actual en tiempo de consulta es un bug de auditoría.

### 3. El estado de deuda se calcula, no se guarda como verdad

`al_dia | moroso` es una **proyección** del ledger, no un campo que alguien edita.
Se puede cachear (columna desnormalizada + recálculo por evento o por job), pero
la fuente de verdad siempre es la suma de cargos menos aplicaciones.

Corolario: el control de acceso por QR (fase 2) consulta esa proyección. Si el
estado fuera editable a mano, el portero dejaría entrar a quien no debe y nadie
podría explicar por qué.

### 4. Nada se corrige mutando: se corrige asentando

| Situación real | Solución incorrecta | Solución correcta |
|---|---|---|
| El tesorero cargó mal un monto | `UPDATE cargo SET monto=...` | Anular el cargo (estado `anulado`) y emitir uno nuevo |
| Se le perdona el mes a un socio | Borrar el cargo | Cargo de tipo `bonificacion` con monto negativo |
| Se aplica recargo por atraso | Sumar al cargo original | Cargo nuevo de tipo `recargo` |
| Se cargó un pago que no existió | Borrar el pago | Contraasiento: pago de reversión |

## Entidades

```
clubes
  └─ configuracion_club        (día de vencimiento, política de mora, prorrateo, moneda)
  └─ usuarios_club             (usuario × club × rol)
  └─ categorias                (activo, cadete, vitalicio…)
       └─ precios_categoria    (monto, vigente_desde)   ← historial
  └─ cuentas                   (unidad de facturación; titular_socio_id)
       └─ socios               (persona; categoria_id, estado, fecha_alta, fecha_baja)
       └─ cargos               (periodo, tipo, concepto, monto, vencimiento, estado)
       └─ pagos                (monto, medio, fecha, referencia_externa, estado)
            └─ aplicaciones_pago (pago_id, cargo_id, monto)
  └─ periodos                  (anio, mes, estado, emitido_por, emitido_at)
  └─ integraciones_pago        (credenciales del club, cifradas)
  └─ eventos_webhook           (idempotencia + auditoría de notificaciones)
  └─ auditoria                 (quién, qué, cuándo, antes/después)
```

## Máquinas de estado

**Socio**
```
              ┌──────────► suspendido ──┐
              │                         │
  alta ──► activo ◄────────────────────┘
              │
              └──────────► baja        (terminal; conserva historia)
```
`moroso` **no** es un estado del socio: es una propiedad derivada de su cuenta.

**Cargo**
```
pendiente ──► parcial ──► pagado
    │            │
    ├────────────┴──► anulado     (por error de emisión)
    └──► bonificado               (perdón total autorizado)
```

**Pago**
```
pendiente ──► aprobado ──► aplicado (total o parcial)
    │            │
    │            └──► devuelto / contracargo
    └──► rechazado / expirado
```

**Período**
```
abierto ──► emitido ──► cerrado
```
`emitido` es irreversible: si se emitió mal, se anulan los cargos, no el período.
La emisión debe ser **idempotente** — reintentar no puede duplicar cargos.
Clave única sugerida: `(cuenta_id, periodo_id, tipo)` para el cargo de cuota.

## Reglas de negocio a confirmar con clubes reales

Cada una es configurable por club, pero necesitamos el **default correcto**:

- [ ] **Prorrateo en el alta.** Socio que entra el día 20: ¿paga el mes completo,
      la parte proporcional, o nada?
- [ ] **Vencimiento.** ¿Día fijo del mes (ej. 10) o N días desde la emisión?
- [ ] **Recargo por mora.** ¿Existe? ¿% fijo, monto fijo, o acumulativo mensual?
- [ ] **Descuento por pago adelantado / anual.** Muy común y muy rentable para el club.
- [ ] **Corte por deuda.** ¿A partir de cuántos meses impagos se suspende el acceso?
- [ ] **Cuota familiar.** ¿Precio del grupo, o suma de individuales con descuento?
- [ ] **Categorías exentas.** Vitalicios y jubilados suelen no pagar o pagar menos.
- [ ] **Matrícula de ingreso.** Cargo de única vez al asociarse.
- [ ] **Cuotas extraordinarias.** Derramas puntuales (obra, viaje, torneo).
- [ ] **Suspensión temporal.** Socio que se va tres meses: ¿se le siguen generando cargos?
