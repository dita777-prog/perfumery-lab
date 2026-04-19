-- Migration 007: Extend the stock_movements_movement_type_check constraint to
-- include values used by the production-batch workflow.
--
-- Original allowed values (from dashboard): restock, use, adjustment
-- New values needed:
--   "production"  — auto-deduction when Create Production Batch is confirmed
--   "correction"  — corrective/reversal entries written manually

-- Drop the existing check constraint (name from the error message)
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

-- Re-add with the full value set
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN ('restock', 'use', 'adjustment', 'production', 'correction'));
