-- Batch traceability: per-production-run records linked to stock movements.

CREATE TABLE production_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_label TEXT NOT NULL,
  formula_id UUID REFERENCES formulas(id),
  produced_grams NUMERIC,
  produced_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_production_batches_formula ON production_batches(formula_id);
CREATE INDEX idx_production_batches_label ON production_batches(batch_label);

ALTER TABLE stock_movements
  ADD COLUMN batch_label TEXT,
  ADD COLUMN production_batch_id UUID REFERENCES production_batches(id);
CREATE INDEX idx_stock_movements_batch ON stock_movements(production_batch_id);
