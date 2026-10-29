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

`paidAt` va en ISO 8601 con zona (`2026-11-03T15:00:00-03:00`); si falta, es ahora.

## Pendiente

- Mercado Pago: OAuth, checkout y webhook idempotente. El webhook registra el
  `Payment` con `method: MERCADO_PAGO` y llama a `allocateOpenBalance` del módulo
  finance, igual que el pago manual.
- Reversiones de pagos como contraasientos.
