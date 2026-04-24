-- Migration 009: Formula role classification (accord vs final).
--
-- Adds formula_role column to formulas to distinguish sub-formulas/accords
-- (reusable building blocks) from final/product formulas.

ALTER TABLE formulas ADD COLUMN IF NOT EXISTS formula_role text DEFAULT 'accord' CHECK (formula_role IN ('accord', 'final'));
