# 03 — MVP

## Definición de "funcional"

> Un club real deja de usar su Excel y cobra la cuota del mes íntegramente con MiClub,
> sin que nosotros toquemos nada a mano.

Ese es el criterio. No "tiene login y CRUD de socios".

## Historia end-to-end que el MVP debe soportar

1. El tesorero se registra, crea el club y **conecta la cuenta de Mercado Pago del club**.
2. Importa su Excel de socios (CSV). El sistema le muestra qué entendió y qué no,
   y le deja corregir antes de confirmar.
3. Define categorías y precios vigentes.
4. **Emite el período** de agosto: se generan los cargos de todas las cuentas activas.
5. El sistema genera un **link de pago por cuenta**; el tesorero los envía por WhatsApp.
6. El socio abre el link, ve cuánto debe y por qué, y paga con Mercado Pago
   **sin registrarse**.
7. El webhook confirma el pago, se aplica al cargo, la cuenta pasa a `al_dia`.
8. Doña Marta pagó en efectivo en la sede: el tesorero **registra el pago manual**.
9. El tesorero abre el panel de morosos y ve exactamente quién debe y cuánto.

Si cualquiera de esos nueve pasos requiere intervención nuestra, el MVP no está listo.

## Alcance

### Entra

**Cuenta y club**
- Registro, login, recuperación de contraseña
- Creación de club, datos básicos, configuración (día de vencimiento, moneda)
- Roles: `owner` y `admin` (dos roles alcanzan; ver doc 06)

**Socios**
- Alta, edición, baja lógica
- Cuentas y grupo familiar (un titular, varios socios)
- Categorías y precios con vigencia
- **Importador inteligente (IA-1)**: mapeo asistido del Excel del club, previsualización,
  detección de duplicados y de grupos familiares, reporte de descartes. Ver [doc 09](09-ia-en-el-producto.md)
- Buscador y filtros: por estado, categoría, deuda

**Cuotas**
- Emisión de período (idempotente, con confirmación previa y resumen de impacto)
- Cargos manuales sueltos (matrícula, extraordinaria)
- Bonificación y anulación
- Vista de cuenta corriente por cuenta: cargos, pagos, saldo

**Cobranza**
- Conexión de la cuenta de Mercado Pago del club (OAuth)
- Link de pago público por cuenta, sin login del socio
- Webhook de confirmación + job de reconciliación
- **Registro de pago manual** (efectivo, transferencia) con constancia
- **Conciliación semántica (IA-2)**: sugerencia de a qué cuenta corresponde una
  transferencia, con confirmación humana obligatoria. Ver [doc 09](09-ia-en-el-producto.md)
- Aplicación automática de pagos a cargos (más viejo primero) y manual

**Comunicación**
- Generación de mensajes de WhatsApp con link personalizado (`wa.me`), en lote
  → deliberadamente semi-manual en el MVP: costo cero, sin API que aprobar, funciona el día 1

**Panel**
- Cobrado del mes vs. emitido, morosidad, cantidad de socios activos
- Listado de deudores exportable

### No entra (explícitamente diferido)

| Fuera del MVP | Por qué |
|---|---|
| Débito automático / suscripciones MP | Es la feature de mayor valor, pero necesita validar el modelo de pagos primero (doc 04) |
| QR de acceso y portería | Fase 2. No condiciona el modelo de datos si respetamos doc 02 |
| Eventos y venta de entradas | Fase 3 |
| App móvil nativa | Web responsive alcanza. El socio entra por un link, no instala nada |
| Portal de autogestión con login del socio | El link sin login cubre el 95% del valor con 5% del trabajo |
| Facturación AFIP/ARCA | Investigar primero si los clubes lo necesitan. MVP emite *recibo*, no factura |
| WhatsApp Business API | Costo, verificación de negocio y plantillas aprobadas. `wa.me` primero |
| Contabilidad, reservas de cancha, escuelitas, buffet | No es un ERP |
| Multi-moneda / otros países | Argentina y ARS |

## Criterios de aceptación

Cada uno es verificable, no opinable:

- [ ] Importar un CSV de 500 socios con datos sucios (DNI faltante, mails repetidos,
      nombres en una sola columna) termina con un padrón usable y un reporte claro de descartes.
- [ ] Emitir el mismo período dos veces **no** duplica cargos.
- [ ] Un pago aprobado en Mercado Pago se refleja en el sistema en < 60 s sin acción manual.
- [ ] Recibir el mismo webhook cinco veces produce un solo pago.
- [ ] Si el webhook nunca llega, el job de reconciliación detecta y aplica el pago.
- [ ] Un pago parcial deja el cargo en `parcial` con el saldo correcto.
- [ ] Un pago mayor al total deja saldo a favor, no un cargo negativo.
- [ ] Un admin del club A no puede leer ni escribir un solo registro del club B
      (verificado con test automatizado, no por revisión de código).
- [ ] El link de pago funciona en un celular de gama baja con 3G, sin instalar nada.
- [ ] La suma de todos los pagos aplicados coincide con lo liquidado en Mercado Pago.

## Anti-objetivos del MVP

- No optimizar para escala. Con 50 clubes × 1000 socios, Postgres no transpira.
- No construir abstracción multi-proveedor de pagos todavía; sí **aislar** Mercado Pago
  detrás de una interfaz para poder reemplazarlo (una implementación, un puerto).
- No hacer diseño personalizado por club (logos sí, temas no).
- No permitir configuración que todavía no pidió ningún club real.

## Recorte asumido por el cronograma académico

El presupuesto real es de **14 semanas con equipo part-time** (ver [doc 10](10-entrega-academica.md)).
Para que el alcance entre junto con las dos funciones de IA, se recorta explícitamente:

| Se recorta | Reemplazo en el MVP |
|---|---|
| Portal de autogestión del socio | Link de pago sin login. Ya estaba fuera de alcance |
| Constancia con numeración correlativa | Comprobante simple descargable |
| Panel de métricas elaborado | Listado de deudores exportable + tres números |
| Roles más allá de `owner` y `admin` | Dos roles |
| Débito automático (fase 1.5) | Cobro por link. Es la primera feature post-defensa |

Lo que **no** se recorta, porque es lo que se evalúa: aislamiento multi-tenant con RLS
probado en CI, ledger inmutable, webhooks idempotentes con reconciliación, y las dos
funciones de IA con su degradación al modo manual.
