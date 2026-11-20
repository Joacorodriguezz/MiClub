-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('OWNER', 'ADMIN');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organization_id_user_id_key" ON "organization_memberships"("organization_id", "user_id");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Aislamiento multi-tenant (escrito a mano, Prisma no genera RLS).
--
-- El tenant de la transacción en curso se lee de `app.organization_id`, que la
-- API setea con `set_config(..., true)` (alcance de transacción) dentro de
-- `withTenant`. Si no está seteado, la función devuelve NULL y las políticas no
-- dejan pasar ninguna fila: falla cerrado.
-- ---------------------------------------------------------------------------

CREATE FUNCTION "app_current_organization_id"() RETURNS UUID
    LANGUAGE sql STABLE
    AS $$ SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid $$;

-- Rol con los permisos de negocio. Sin LOGIN y sin BYPASSRLS: la API lo asume
-- con `SET LOCAL ROLE` dentro de cada transacción con tenant.
--
-- La API no se conecta con el usuario que corre las migraciones: se conecta con
-- un rol LOGIN propio de cada ambiente, sin SUPERUSER ni BYPASSRLS, miembro de
-- `miclub_app` (en CI, `miclub_runtime`). Ese rol no se crea acá porque sus
-- credenciales son del ambiente, no del repo.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'miclub_app') THEN
        CREATE ROLE "miclub_app" NOLOGIN NOBYPASSRLS;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA "public" TO "miclub_app";
GRANT EXECUTE ON FUNCTION "app_current_organization_id"() TO "miclub_app";

-- Sin DELETE: nada se borra, las bajas son lógicas (`deleted_at`).
GRANT SELECT, INSERT, UPDATE ON "organizations" TO "miclub_app";
-- Las membresías se crean desde el flujo de invitación/plataforma, no desde un
-- tenant: si el club pudiera insertarlas, se agregaría a cualquier usuario por
-- su id y pasaría a ver su email (la política de `users` muestra a los
-- miembros). Por la misma razón no puede cambiar `user_id` ni `organization_id`.
GRANT SELECT ON "organization_memberships" TO "miclub_app";
GRANT UPDATE ("role", "updated_at", "deleted_at") ON "organization_memberships" TO "miclub_app";
-- Los usuarios se crean desde el flujo de auth/plataforma, no con un tenant.
GRANT SELECT ON "users" TO "miclub_app";

-- FORCE: el dueño de las tablas también queda sujeto a las políticas.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- Un tenant solo ve y modifica su propia organización.
CREATE POLICY "organizations_tenant_isolation" ON "organizations"
    FOR ALL TO "miclub_app"
    USING ("id" = "app_current_organization_id"())
    WITH CHECK ("id" = "app_current_organization_id"());

-- Un tenant solo ve y modifica membresías de su organización.
CREATE POLICY "organization_memberships_tenant_isolation" ON "organization_memberships"
    FOR ALL TO "miclub_app"
    USING ("organization_id" = "app_current_organization_id"())
    WITH CHECK ("organization_id" = "app_current_organization_id"());

-- Un tenant solo ve a los usuarios que son miembros de su organización.
CREATE POLICY "users_visible_to_tenant" ON "users"
    FOR SELECT TO "miclub_app"
    USING (EXISTS (
        SELECT 1
        FROM "organization_memberships" AS m
        WHERE m."user_id" = "users"."id"
          AND m."organization_id" = "app_current_organization_id"()
    ));
