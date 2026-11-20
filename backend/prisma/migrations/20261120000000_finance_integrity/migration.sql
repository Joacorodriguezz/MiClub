CREATE UNIQUE INDEX "billing_periods_organization_id_id_key" ON "billing_periods" ("organization_id", "id");
ALTER TABLE "charges" DROP CONSTRAINT "charges_billing_period_id_fkey",
    ADD CONSTRAINT "charges_organization_id_billing_period_id_fkey"
    FOREIGN KEY ("organization_id", "billing_period_id") REFERENCES "billing_periods" ("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD COLUMN "request_id" UUID;
CREATE UNIQUE INDEX "payments_organization_id_request_id_key" ON "payments" ("organization_id", "request_id");

CREATE FUNCTION app_lock_ledger_accounts(accounts uuid[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE account uuid;
BEGIN
    FOR account IN SELECT DISTINCT id FROM unnest(accounts) AS ids(id) ORDER BY id LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || account::text, 0));
    END LOOP;
END
$$;
