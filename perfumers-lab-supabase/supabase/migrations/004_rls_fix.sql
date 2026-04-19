-- Migration 004: Fix RLS on tables added in migration 003.
--
-- Context: migration 001 explicitly left all original tables without RLS enabled,
-- using the anon/service_role key for a private single-user app.
-- Migration 003 added production_batches (and columns on stock_movements) but did
-- not match that pattern — Supabase may have auto-enabled RLS, blocking inserts
-- that use .insert().select().single() via the anon key.
--
-- Fix: disable RLS on production_batches to match all other tables in this app.
-- Also add permissive policies as a belt-and-suspenders measure for both
-- anon and authenticated roles, covering INSERT + SELECT (both required because
-- postJson uses .insert().select().single() which needs SELECT after INSERT).

-- 1. Disable RLS entirely on production_batches (matches 001_init.sql pattern)
ALTER TABLE public.production_batches DISABLE ROW LEVEL SECURITY;

-- 2. Belt-and-suspenders: also add open policies in case Supabase dashboard
--    re-enables RLS or the project auth settings change.
--    These are no-ops when RLS is disabled but activate automatically if RLS
--    is ever re-enabled.

DO $$
BEGIN
  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'production_batches'
      AND policyname = 'Allow all for anon and authenticated'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow all for anon and authenticated"
      ON public.production_batches
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
    $policy$;
  END IF;
END
$$;

-- 3. stock_movements: same treatment.
--    The original table was created without RLS in 001. The ALTER TABLE in 003
--    added columns but did not touch RLS. Explicitly confirm it stays disabled
--    and add the same belt-and-suspenders policy.
ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'stock_movements'
      AND policyname = 'Allow all for anon and authenticated'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow all for anon and authenticated"
      ON public.stock_movements
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
    $policy$;
  END IF;
END
$$;
