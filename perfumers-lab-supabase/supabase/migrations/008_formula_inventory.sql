-- Migration 008: Formula inventory — two-layer inventory tracking.
--
-- Adds formula_inventory_movements: event-sourced ledger of NEAT formula stock.
-- production_in rows are auto-created when a production batch is made; consumption_out
-- rows are inserted when a NEAT formula is used in a finished product.

CREATE TABLE IF NOT EXISTS formula_inventory_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  formula_id uuid NOT NULL REFERENCES formulas(id),
  movement_type text NOT NULL CHECK (movement_type IN ('production_in', 'consumption_out', 'adjustment', 'waste')),
  grams_delta numeric NOT NULL,
  cost_per_gram numeric,
  total_cost numeric,
  production_batch_id uuid REFERENCES production_batches(id),
  related_formula_id uuid REFERENCES formulas(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formula_inventory_movements_formula ON formula_inventory_movements(formula_id);
CREATE INDEX IF NOT EXISTS idx_formula_inventory_movements_batch ON formula_inventory_movements(production_batch_id);
CREATE INDEX IF NOT EXISTS idx_formula_inventory_movements_related ON formula_inventory_movements(related_formula_id);

GRANT ALL ON formula_inventory_movements TO anon, authenticated;

ALTER TABLE public.formula_inventory_movements DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'formula_inventory_movements'
      AND policyname = 'Allow all for anon and authenticated'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow all for anon and authenticated"
      ON public.formula_inventory_movements
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
    $policy$;
  END IF;
END
$$;
