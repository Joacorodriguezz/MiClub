-- Permite comprobar una membresía antes de fijar el tenant.
--
-- El rol de runtime no ve filas si `app.organization_id` no está seteado. Si el
-- middleware hiciera `withTenant` antes de saber que el usuario es miembro,
-- abriría los datos de ese club. Esta función responde solo el rol (nunca el
-- email) y corre como el dueño de la migración, que sí puede leer las tablas.
-- Quien la llama sigue siendo el rol de runtime: no recibe BYPASSRLS.

CREATE FUNCTION "app_membership_role"(p_auth_user_id uuid, p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m."role"::text
  FROM "organization_memberships" AS m
  INNER JOIN "users" AS u ON u."id" = m."user_id"
  INNER JOIN "organizations" AS o ON o."id" = m."organization_id"
  WHERE u."auth_user_id" = p_auth_user_id
    AND m."organization_id" = p_organization_id
    AND u."deleted_at" IS NULL
    AND m."deleted_at" IS NULL
    AND o."deleted_at" IS NULL
$$;

REVOKE ALL ON FUNCTION "app_membership_role"(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_membership_role"(uuid, uuid) TO "miclub_app";

-- En Supabase, los privilegios por defecto pueden otorgar EXECUTE a estos roles.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION "app_membership_role"(uuid, uuid) FROM %I', role_name);
    END IF;
  END LOOP;
END
$$;
