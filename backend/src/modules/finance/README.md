# Módulo: finance

Deuda que una cuenta tiene con el club y su cuenta corriente. Separar estrictamente:

- **BillingPeriod**: período de cobro mensual (`OPEN` → `ISSUED` → `CLOSED`, sin vuelta atrás).
- **Charge**: deuda concreta de una cuenta en un período (cuota `FEE` o recargo
  `LATE_FEE`). Inmutable: el monto queda congelado al emitir.
- **PaymentAllocation**: qué parte de un pago cancela qué cargo.
- **FeePlan** (pendiente): regla de cuánto debería pagar alguien. Hoy el monto lo
  pasa quien emite. Sale del padrón (categoría y precio vigente).

No confundir Charge con Payment (movimiento real de dinero, en el módulo payments).

## Implementado

- `billing-periods.service.ts`: crear y listar períodos, y **emisión idempotente**
  (un cargo por cuenta, período y tipo; reemitir no duplica).
- `ledger.service.ts`: aplicación FIFO del dinero sin aplicar a los cargos abiertos
  (`allocateOpenBalance`) y **cuenta corriente derivada** (`getAccountStatement`):
  estado de cada cargo, deuda, saldo a favor, vencido y "al día / moroso".
- `allocation.ts`: el reparto FIFO como función pura.
- La base hace cumplir las reglas: montos positivos en centavos, cargos/pagos/
  aplicaciones sin UPDATE ni DELETE, tope de las aplicaciones y RLS por club
  (migración `finance_ledger`).

## API (`/api/v1`, exige usuario autenticado con club)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/billing-periods` | Lista los períodos del club |
| POST | `/billing-periods` | Crea un período: `{ year, month, dueDate: "YYYY-MM-DD" }` |
| POST | `/billing-periods/:periodId/issue` | Emite cuotas: `{ charges: [{ accountId, amountCents, concept? }] }` |
| GET | `/accounts/:accountId/statement` | Cuenta corriente de una cuenta |

Montos en JSON: enteros en centavos (`amountCents: 1500000` = $15.000).

## Pendiente

- FK de `account_id` a la tabla de cuentas (la crea el módulo de padrón).
- Bonificaciones y anulaciones de cargos como contraasientos.
- IA-2: conciliación semántica de pagos (doc 09).
