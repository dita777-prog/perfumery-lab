-- Migration 005: Grant explicit SELECT/INSERT/UPDATE/DELETE privileges to anon
-- and authenticated roles on production_batches and stock_movements.
--
-- Context: RLS is disabled (migration 004) but the anon key still needs
-- PostgreSQL-level GRANT to execute .insert().select().single() — the SELECT
-- after INSERT returns 0 rows without this grant even when RLS is off.
--
-- This matches the implicit grants Supabase gives to tables created via the
-- dashboard; tables created via raw SQL migrations sometimes miss them.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.production_batches
  TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.stock_movements
  TO anon, authenticated;

-- Sequences (needed for any serial/uuid default columns if referenced)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
