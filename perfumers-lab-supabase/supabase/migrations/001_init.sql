-- Perfumer's Lab — Drip of Infinity
-- Supabase init migration: all 15 tables + trigger + RPC

-- Enable uuid extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Olfactive Families
CREATE TABLE olfactive_families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Formula Categories
CREATE TABLE formula_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3) Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  country TEXT,
  min_order_value NUMERIC,
  shipping_cost_estimate NUMERIC,
  avg_delivery_days INTEGER,
  reliability_score INTEGER,
  quality_score INTEGER,
  notes TEXT,
  speciality TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4) Materials
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  alt_names TEXT[],
  cas_number TEXT,
  botanical_name TEXT,
  olfactive_family_id UUID REFERENCES olfactive_families(id),
  pyramid_role TEXT,
  flash_point NUMERIC,
  solubility_notes TEXT,
  recommended_dilutions TEXT,
  behavior_wax TEXT,
  behavior_alcohol TEXT,
  behavior_nebulizer TEXT,
  behavior_diffuser TEXT,
  strength INTEGER,
  dominance INTEGER,
  projection INTEGER,
  treat_as_solvent BOOLEAN DEFAULT false,
  tags TEXT[],
  notes_sensory TEXT,
  status TEXT DEFAULT 'in_stock',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5) Material Sources
CREATE TABLE material_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_material_name TEXT,
  batch_lot TEXT,
  purchase_date DATE,
  purchase_price NUMERIC,
  purchase_quantity_grams NUMERIC,
  price_per_gram NUMERIC,
  stock_grams NUMERIC,
  reorder_threshold_grams NUMERIC,
  status TEXT DEFAULT 'in_stock',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6) Material IFRA Limits
CREATE TABLE material_ifra_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  ifra_category TEXT,
  limit_percent NUMERIC,
  notes TEXT,
  source TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7) Material Dilutions
CREATE TABLE material_dilutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_material_id UUID REFERENCES materials(id),
  source_material_source_id UUID REFERENCES material_sources(id),
  name TEXT NOT NULL,
  dilution_percent NUMERIC NOT NULL,
  solvent_material_id UUID REFERENCES materials(id),
  solvent_name TEXT,
  neat_multiplier NUMERIC NOT NULL,
  prepared_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8) Formulas
CREATE TABLE formulas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES formula_categories(id),
  version INTEGER DEFAULT 1,
  parent_formula_id UUID REFERENCES formulas(id),
  status TEXT DEFAULT 'working',
  product_type TEXT,
  intended_concentration_percent NUMERIC,
  total_batch_grams NUMERIC,
  units_in_batch INTEGER,
  version_goal TEXT,
  change_notes TEXT,
  author TEXT,
  formula_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9) Formula Ingredients
CREATE TABLE formula_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'material',
  material_id UUID REFERENCES materials(id),
  dilution_id UUID REFERENCES material_dilutions(id),
  source_formula_id UUID REFERENCES formulas(id),
  grams_as_weighed NUMERIC NOT NULL,
  neat_grams NUMERIC,
  percent_in_formula NUMERIC,
  pyramid_role TEXT,
  role TEXT,
  highlight_type TEXT DEFAULT 'none',
  highlight_color TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10) Tests
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formula_id UUID REFERENCES formulas(id),
  formula_version INTEGER,
  test_date TIMESTAMPTZ DEFAULT now(),
  medium TEXT,
  cure_time_hours INTEGER,
  maceration_time_hours INTEGER,
  intensity INTEGER,
  throw_diffusion INTEGER,
  longevity INTEGER,
  what_was_wrong TEXT,
  what_to_try_next TEXT,
  decision TEXT,
  tester TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11) Decisions
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date TIMESTAMPTZ DEFAULT now(),
  category TEXT,
  what_was_decided TEXT,
  why TEXT,
  what_was_rejected TEXT,
  why_rejected TEXT,
  related_material_id UUID REFERENCES materials(id),
  related_formula_id UUID REFERENCES formulas(id),
  related_supplier_id UUID REFERENCES suppliers(id),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12) Stock Movements
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_source_id UUID REFERENCES material_sources(id),
  movement_type TEXT,
  grams_delta NUMERIC,
  related_formula_id UUID REFERENCES formulas(id),
  date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13) Supplier Price History
CREATE TABLE supplier_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id),
  material_id UUID REFERENCES materials(id),
  price_per_gram NUMERIC,
  date_recorded TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- 14) Attachments
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15) Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ TRIGGER: stock_movements auto-update source stock_grams ============
CREATE OR REPLACE FUNCTION fn_update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.material_source_id IS NOT NULL AND NEW.grams_delta IS NOT NULL THEN
    UPDATE material_sources
    SET stock_grams = COALESCE(stock_grams, 0) + NEW.grams_delta
    WHERE id = NEW.material_source_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movement_update
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION fn_update_stock_on_movement();

-- ============ TRIGGER: delete formula_category → nullify formulas.category_id ============
CREATE OR REPLACE FUNCTION fn_nullify_formula_category()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE formulas SET category_id = NULL WHERE category_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nullify_formula_category
BEFORE DELETE ON formula_categories
FOR EACH ROW EXECUTE FUNCTION fn_nullify_formula_category();

-- ============ RPC: duplicate_formula ============
CREATE OR REPLACE FUNCTION duplicate_formula(original_id UUID, new_name TEXT)
RETURNS UUID AS $$
DECLARE
  new_id UUID := uuid_generate_v4();
  orig RECORD;
  ing RECORD;
BEGIN
  SELECT * INTO orig FROM formulas WHERE id = original_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formula not found';
  END IF;

  INSERT INTO formulas (id, name, category_id, version, parent_formula_id, status, product_type,
    intended_concentration_percent, total_batch_grams, units_in_batch, version_goal, change_notes,
    author, formula_notes, created_at, updated_at)
  VALUES (new_id, new_name, orig.category_id, COALESCE(orig.version, 1) + 1, original_id,
    orig.status, orig.product_type, orig.intended_concentration_percent, orig.total_batch_grams,
    orig.units_in_batch, orig.version_goal, orig.change_notes, orig.author, orig.formula_notes,
    now(), now());

  FOR ing IN SELECT * FROM formula_ingredients WHERE formula_id = original_id LOOP
    INSERT INTO formula_ingredients (id, formula_id, source_type, material_id, dilution_id,
      source_formula_id, grams_as_weighed, neat_grams, percent_in_formula, pyramid_role,
      role, highlight_type, highlight_color, notes, sort_order, created_at)
    VALUES (uuid_generate_v4(), new_id, ing.source_type, ing.material_id, ing.dilution_id,
      ing.source_formula_id, ing.grams_as_weighed, ing.neat_grams, ing.percent_in_formula,
      ing.pyramid_role, ing.role, ing.highlight_type, ing.highlight_color, ing.notes,
      ing.sort_order, now());
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ============ RLS: Disable for now (single-user app, no auth) ============
-- When auth is added later, enable RLS on all tables and add policies.
-- For now we keep tables accessible to the anon/service_role key.

-- ============ Indexes for common queries ============
CREATE INDEX idx_materials_olfactive_family ON materials(olfactive_family_id);
CREATE INDEX idx_material_sources_material ON material_sources(material_id);
CREATE INDEX idx_material_sources_supplier ON material_sources(supplier_id);
CREATE INDEX idx_material_ifra_limits_material ON material_ifra_limits(material_id);
CREATE INDEX idx_material_dilutions_source ON material_dilutions(source_material_id);
CREATE INDEX idx_formulas_category ON formulas(category_id);
CREATE INDEX idx_formula_ingredients_formula ON formula_ingredients(formula_id);
CREATE INDEX idx_tests_formula ON tests(formula_id);
CREATE INDEX idx_decisions_material ON decisions(related_material_id);
CREATE INDEX idx_decisions_formula ON decisions(related_formula_id);
CREATE INDEX idx_stock_movements_source ON stock_movements(material_source_id);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name, record_id);
