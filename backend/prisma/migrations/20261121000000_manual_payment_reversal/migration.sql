CREATE UNIQUE INDEX payments_organization_id_id_key ON payments (organization_id, id);
CREATE TABLE payment_reversals (
    payment_id uuid PRIMARY KEY,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
    created_at timestamptz(6) NOT NULL DEFAULT now(),
    UNIQUE (organization_id, payment_id),
    FOREIGN KEY (organization_id, payment_id) REFERENCES payments(organization_id, id),
    FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships(organization_id, user_id)
);
ALTER TABLE payment_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reversals FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_reversals_tenant_isolation ON payment_reversals FOR ALL TO miclub_app
    USING (organization_id = app_current_organization_id())
    WITH CHECK (organization_id = app_current_organization_id());
GRANT SELECT, INSERT ON payment_reversals TO miclub_app;
CREATE TRIGGER payment_reversals_immutable BEFORE UPDATE OR DELETE ON payment_reversals
    FOR EACH ROW EXECUTE FUNCTION app_forbid_ledger_mutation();

CREATE FUNCTION app_check_manual_payment_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original payments%ROWTYPE;
BEGIN
    SELECT * INTO original FROM payments WHERE organization_id = NEW.organization_id AND id = NEW.payment_id;
    IF NOT FOUND OR original.method = 'MERCADO_PAGO' THEN
        RAISE EXCEPTION 'Se requiere un pago manual del club';
    END IF;
    PERFORM app_lock_ledger_accounts(ARRAY[original.account_id]);
    RETURN NEW;
END
$$;
CREATE TRIGGER payment_reversals_check BEFORE INSERT ON payment_reversals
    FOR EACH ROW EXECUTE FUNCTION app_check_manual_payment_reversal();

-- Al reabrir deuda, otro pago puede volver a aplicarse al mismo cargo.
DROP INDEX payment_allocations_payment_id_charge_id_key;
CREATE INDEX payment_allocations_payment_id_charge_id_idx ON payment_allocations(payment_id, charge_id);

CREATE OR REPLACE FUNCTION "app_check_payment_allocation"() RETURNS trigger
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

    IF EXISTS (SELECT 1 FROM payment_reversals WHERE payment_id = NEW.payment_id AND organization_id = NEW.organization_id) THEN
        RAISE EXCEPTION 'El pago fue revertido';
    END IF;

    SELECT COALESCE(SUM("amount_cents"), 0) INTO v_used
        FROM "payment_allocations" WHERE "payment_id" = NEW."payment_id";
    IF v_used + NEW."amount_cents" > v_payment."amount_cents" THEN
        RAISE EXCEPTION 'La aplicación supera el saldo disponible del pago %', NEW."payment_id";
    END IF;

    SELECT COALESCE(SUM("amount_cents"), 0) INTO v_used
        FROM payment_allocations a WHERE a.charge_id = NEW.charge_id
          AND NOT EXISTS (SELECT 1 FROM payment_reversals r WHERE r.payment_id = a.payment_id AND r.organization_id = NEW.organization_id);
    IF v_used + NEW."amount_cents" > v_charge."amount_cents" THEN
        RAISE EXCEPTION 'La aplicación supera lo que falta pagar del cargo %', NEW."charge_id";
    END IF;

    RETURN NEW;
END
$$;
