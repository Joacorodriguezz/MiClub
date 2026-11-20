# Módulo: payments

Movimientos reales de dinero. Entidad principal: **Payment** (inmutable).

Separar siempre Charge (deuda) de Payment (pago). Proveedor online inicial:
Mercado Pago, pero el dominio NO se acopla al SDK: la integración vive en
`infrastructure/payments/` (ej. MercadoPagoProvider).

## Implementado

- `payments.service.ts`: `recordManualPayment` registra un pago en efectivo,
  transferencia u otro medio y lo aplica a los cargos abiertos de la cuenta
  (los más viejos primero). Lo que sobra queda como saldo a favor.
- `externalReference` es única por club: registrar dos veces el mismo pago da 409.

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/v1/accounts/:accountId/payments` | `{ amountCents, method: CASH\|TRANSFER\|OTHER, paidAt?, externalReference?, notes? }` |
| POST | `/api/v1/accounts/:accountId/payments/:paymentId/reversal` | Revierte íntegramente el pago manual y registra el usuario, la fecha y el motivo obligatorio (`reason`). |

`paidAt` va en ISO 8601 con zona (`2026-11-03T15:00:00-03:00`); si falta, es ahora.

Un reintento de reversión devuelve el asiento original. La cuenta corriente conserva el pago y su motivo de reversión, descuenta el importe de los totales y vuelve a aplicar cualquier otro crédito disponible por orden FIFO.

## Pendiente

- Mercado Pago: OAuth, checkout y webhook idempotente. El webhook registra el
  `Payment` con `method: MERCADO_PAGO` y llama a `allocateOpenBalance` del módulo
  finance, igual que el pago manual.
- Devoluciones y contracargos informados por Mercado Pago.

Para reintentar un pago manual sin referencia externa, el cliente genera un UUID por operación y envía el mismo valor en el header `Idempotency-Key`. Un reintento responde 409 y conserva el primer asiento. Dos pagos distintos en efectivo requieren claves distintas. La clave y la referencia son únicas dentro del club.
