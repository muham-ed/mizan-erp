-- apps/api/prisma/sql/rls.sql
-- =====================================================================
-- Mizan ERP — Row Level Security for tenant isolation.
--
-- Run AFTER `prisma migrate deploy`. Idempotent.
--
-- The API sets these LOCAL settings inside transactions:
--   SET LOCAL app.current_tenant_id = '<cuid>';
--   SET LOCAL app.is_super_admin   = 'true';   -- admin/seed only
--
-- Both are LOCAL → scoped to the transaction → no cross-connection leak.
-- =====================================================================

-- ---------- Helper functions ----------

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '');
$$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.is_super_admin', true), '') = 'true';
$$;

-- ---------- Enable + FORCE RLS on tenant-scoped tables ----------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users',
    'categories',
    'products',
    'warehouses',
    'stock_levels',
    'stock_movements',
    'customers',
    'invoices',
    'invoice_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    -- FORCE makes RLS apply even to the table owner
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);

    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        FOR ALL
        USING       (tenant_id = current_tenant_id() OR is_super_admin())
        WITH CHECK  (tenant_id = current_tenant_id() OR is_super_admin());
    $f$, t);
  END LOOP;
END $$;

-- ---------- Verification helper (dev only) ----------
CREATE OR REPLACE VIEW rls_status AS
SELECT
  schemaname,
  tablename,
  rowsecurity     AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p
   WHERE p.schemaname = c.schemaname AND p.tablename = c.tablename) AS policy_count
FROM pg_tables c
WHERE schemaname = 'public'
  AND tablename IN (
    'users','categories','products','warehouses','stock_levels',
    'stock_movements','customers','invoices','invoice_items'
  );
