-- CreateEnum
CREATE TYPE "billing_period_status" AS ENUM ('OPEN', 'ISSUED', 'CLOSED');

-- CreateEnum
CREATE TYPE "charge_type" AS ENUM ('FEE', 'LATE_FEE');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'TRANSFER', 'MERCADO_PAGO', 'OTHER');

-- CreateTable
CREATE TABLE "billing_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "billing_period_status" NOT NULL DEFAULT 'OPEN',
    "issued_at" TIMESTAMPTZ(6),
    "issued_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "billing_period_id" UUID NOT NULL,
    "type" "charge_type" NOT NULL,
    "concept" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
    "due_date" DATE NOT NULL,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
    "method" "payment_method" NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "external_reference" TEXT,
    "notes" TEXT,
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_organization_id_year_month_key" ON "billing_periods"("organization_id", "year", "month");

-- CreateIndex
CREATE INDEX "charges_organization_id_account_id_idx" ON "charges"("organization_id", "account_id");

-- CreateIndex
CREATE INDEX "charges_billing_period_id_idx" ON "charges"("billing_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "charges_organization_id_account_id_billing_period_id_type_key" ON "charges"("organization_id", "account_id", "billing_period_id", "type");

-- CreateIndex
CREATE INDEX "payments_organization_id_account_id_idx" ON "payments"("organization_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_external_reference_key" ON "payments"("organization_id", "external_reference");

-- CreateIndex
CREATE INDEX "payment_allocations_charge_id_idx" ON "payment_allocations"("charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_charge_id_key" ON "payment_allocations"("payment_id", "charge_id");

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_issued_by_user_id_fkey" FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Reglas del ledger (escrito a mano: Prisma no genera checks, triggers ni RLS).
--
-- 1. Montos en centavos, positivos, en ARS (único medio del MVP).
-- 2. Cargos, pagos y aplicaciones son inmutables: sin UPDATE ni DELETE, ni
--    siquiera para el dueño de las tablas. Se corrige asentando registros nuevos.
-- 3. Una aplicación nunca puede cancelar más que lo que queda del cargo ni usar
--    más que lo que queda del pago, y pago y cargo son de la misma cuenta.
-- 4. Un período emitido no vuelve a abierto.
-- 5. RLS por `organization_id` en las cuatro tablas, como en `init_tenancy`.
-- ---------------------------------------------------------------------------

-- 1. Montos y datos válidos
ALTER TABLE "billing_periods"
    ADD CONSTRAINT "billing_periods_month_check" CHECK ("month" BETWEEN 1 AND 12),
    ADD CONSTRAINT "billing_periods_year_check" CHECK ("year" BETWEEN 2000 AND 2100);

ALTER TABLE "charges"
    ADD CONSTRAINT "charges_amount_cents_check" CHECK ("amount_cents" > 0),
    ADD CONSTRAINT "charges_currency_check" CHECK ("currency" = 'ARS'),
    ADD CONSTRAINT "charges_concept_check" CHECK (length(btrim("concept")) > 0);

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_cents_check" CHECK ("amount_cents" > 0),
    ADD CONSTRAINT "payments_currency_check" CHECK ("currency" = 'ARS');

ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_amount_cents_check" CHECK ("amount_cents" > 0);

-- 2. Inmutabilidad de los registros de dinero
CREATE FUNCTION "app_forbid_ledger_mutation"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de dinero son inmutables (% en %): corregir con un contraasiento',
        TG_OP, TG_TABLE_NAME;
END
$$;

CREATE TRIGGER "charges_immutable"
    BEFORE UPDATE OR DELETE ON "charges"
    FOR EACH ROW EXECUTE FUNCTION "app_forbid_ledger_mutation"();

CREATE TRIGGER "payments_immutable"
    BEFORE UPDATE OR DELETE ON "payments"
    FOR EACH ROW EXECUTE FUNCTION "app_forbid_ledger_mutation"();

CREATE TRIGGER "payment_allocations_immutable"
    BEFORE UPDATE OR DELETE ON "payment_allocations"
    FOR EACH ROW EXECUTE FUNCTION "app_forbid_ledger_mutation"();

-- 3. Consistencia de las aplicaciones de pago.
-- Corre con los permisos de quien inserta (SECURITY INVOKER), así que las
-- lecturas respetan RLS: un pago o cargo de otro club no existe para el trigger.
-- El lock por cuenta serializa aplicaciones concurrentes sobre la misma cuenta.
CREATE FUNCTION "app_check_payment_allocation"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_payment "payments"%ROWTYPE;
    v_charge "charges"%ROWTYPE;
    v_used BIGINT;
BEGIN
    SELECT * INTO v_payment FROM "payments" WHERE "id" = NEW."payment_id";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago % inexistente', NEW."payment_id";
    END IF;

    SELECT * INTO v_charge FROM "charges" WHERE "id" = NEW."charge_id";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cargo % inexistente', NEW."charge_id";
    END IF;

    IF v_payment."organization_id" <> NEW."organization_id"
        OR v_charge."organization_id" <> NEW."organization_id" THEN
        RAISE EXCEPTION 'Pago y cargo deben ser del mismo club que la aplicación';
    END IF;

    IF v_payment."account_id" <> v_charge."account_id" THEN
        RAISE EXCEPTION 'Pago y cargo deben ser de la misma cuenta';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || v_charge."account_id"::text, 0));

    SELECT COALESCE(SUM("amount_cents"), 0) INTO v_used
        FROM "payment_allocations" WHERE "payment_id" = NEW."payment_id";
    IF v_used + NEW."amount_cents" > v_payment."amount_cents" THEN
        RAISE EXCEPTION 'La aplicación supera el saldo disponible del pago %', NEW."payment_id";
    END IF;

    SELECT COALESCE(SUM("amount_cents"), 0) INTO v_used
        FROM "payment_allocations" WHERE "charge_id" = NEW."charge_id";
    IF v_used + NEW."amount_cents" > v_charge."amount_cents" THEN
        RAISE EXCEPTION 'La aplicación supera lo que falta pagar del cargo %', NEW."charge_id";
    END IF;

    RETURN NEW;
END
$$;

CREATE TRIGGER "payment_allocations_check"
    BEFORE INSERT ON "payment_allocations"
    FOR EACH ROW EXECUTE FUNCTION "app_check_payment_allocation"();

-- 4. Ciclo de vida del período: OPEN -> ISSUED -> CLOSED, sin vuelta atrás.
CREATE FUNCTION "app_check_billing_period_update"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW."organization_id" <> OLD."organization_id"
        OR NEW."year" <> OLD."year"
        OR NEW."month" <> OLD."month" THEN
        RAISE EXCEPTION 'El club, el año y el mes de un período no se modifican';
    END IF;

    IF OLD."status" <> 'OPEN' AND NEW."due_date" <> OLD."due_date" THEN
        RAISE EXCEPTION 'El vencimiento de un período emitido no se modifica';
    END IF;

    IF (OLD."status" = 'ISSUED' AND NEW."status" = 'OPEN')
        OR (OLD."status" = 'CLOSED' AND NEW."status" <> 'CLOSED') THEN
        RAISE EXCEPTION 'El período no puede volver de % a %', OLD."status", NEW."status";
    END IF;

    RETURN NEW;
END
$$;

CREATE TRIGGER "billing_periods_lifecycle"
    BEFORE UPDATE ON "billing_periods"
    FOR EACH ROW EXECUTE FUNCTION "app_check_billing_period_update"();

-- 5. Permisos del rol de runtime y aislamiento por club.
-- Los registros de dinero solo admiten SELECT e INSERT.
GRANT SELECT, INSERT, UPDATE ON "billing_periods" TO "miclub_app";
GRANT SELECT, INSERT ON "charges" TO "miclub_app";
GRANT SELECT, INSERT ON "payments" TO "miclub_app";
GRANT SELECT, INSERT ON "payment_allocations" TO "miclub_app";

ALTER TABLE "billing_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_periods" FORCE ROW LEVEL SECURITY;
ALTER TABLE "charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "charges" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "billing_periods_tenant_isolation" ON "billing_periods"
    FOR ALL TO "miclub_app"
    USING ("organization_id" = "app_current_organization_id"())
    WITH CHECK ("organization_id" = "app_current_organization_id"());

CREATE POLICY "charges_tenant_isolation" ON "charges"
    FOR ALL TO "miclub_app"
    USING ("organization_id" = "app_current_organization_id"())
    WITH CHECK ("organization_id" = "app_current_organization_id"());

CREATE POLICY "payments_tenant_isolation" ON "payments"
    FOR ALL TO "miclub_app"
    USING ("organization_id" = "app_current_organization_id"())
    WITH CHECK ("organization_id" = "app_current_organization_id"());

CREATE POLICY "payment_allocations_tenant_isolation" ON "payment_allocations"
    FOR ALL TO "miclub_app"
    USING ("organization_id" = "app_current_organization_id"())
    WITH CHECK ("organization_id" = "app_current_organization_id"());
