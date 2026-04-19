-- Migration 006: Grant SELECT/INSERT/UPDATE/DELETE on ALL app tables to anon
-- and authenticated roles.
--
-- Context: tables created via raw SQL migrations (not the Supabase dashboard)
-- do not automatically inherit the default Supabase privilege grants. This
-- causes .insert().select().single() to return 0 rows even when RLS is
-- disabled, because PostgreSQL-level SELECT is still denied to the anon role.
--
-- Fix: grant full DML access on every table the app uses. This is correct for
-- a private single-user app where row-level security is intentionally off.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.olfactive_families     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_sources       TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_ifra_limits   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_dilutions     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_price_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formula_categories     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulas               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formula_ingredients    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests                  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_price_history TO anon, authenticated;

-- Sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
