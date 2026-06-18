ALTER TABLE formulas
ADD COLUMN IF NOT EXISTS commercial_name TEXT;

CREATE INDEX IF NOT EXISTS idx_formulas_commercial_name
ON formulas (commercial_name);
