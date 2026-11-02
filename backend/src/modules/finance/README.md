# Módulo: finance

El ledger cobra sobre una **cuenta**, no directamente sobre una persona. Separa:

- **Charge**: deuda concreta y congelada, emitida para un período.
- **Payment**: dinero recibido, manual o digital.
- **PaymentApplication**: vínculo inmutable entre un pago y uno o más cargos.

La lógica pura de `ledger.ts` ya implementa dos reglas de dominio comprobables:

- aplicación de pagos a los cargos abiertos de vencimiento más antiguo primero;
- saldo derivado como `cargos - aplicaciones`, nunca como campo mutable.

Todavía no hay persistencia ni endpoints: dependen de que el módulo Padrón defina y
migre la cuenta de facturación compartida. Cuando exista, las transacciones deberán
pasar por `withTenant` y guardar los asientos sin `UPDATE` ni `DELETE`.
