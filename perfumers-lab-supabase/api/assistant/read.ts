// GET /api/assistant/read?table=<name>&filter=field:value&search=<term>&search_field=name&order=name&ascending=true&limit=50&offset=0
// Whitelisted read endpoint for the external assistant.
// Required env vars: ASSISTANT_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js';
function checkAuth(req: any): boolean { const auth = (req.headers['authorization'] || req.headers['Authorization'] || '') as string; const token = auth.replace('Bearer ', '').trim(); return !!process.env.ASSISTANT_API_TOKEN && token === process.env.ASSISTANT_API_TOKEN; }
function hasTokenConfigured(): boolean { return !!process.env.ASSISTANT_API_TOKEN; }

const TABLE_COLUMNS: Record<string, string> = {
  formulas: 'id, name, category_id, status, archived_at, intended_concentration_percent, total_batch_grams',
  formula_ingredients: 'id, formula_id, material_id, grams_as_weighed, neat_grams, percent_in_formula, source_type, source_formula_id, dilution, note, sort_order',
  materials: 'id, name, treat_as_solvent, unit',
  material_sources: 'id, material_id, supplier_id, stock_grams, price_per_gram',
  production_batches: 'id, batch_label, formula_id, produced_grams, produced_at, notes',
  stock_movements: 'id, material_source_id, movement_type, grams_delta, related_formula_id, date, notes, batch_label, production_batch_id, created_at',
  formula_categories: 'id, name',
};

const ALLOWED_ORDER_FIELDS: Record<string, string[]> = {
  formulas: ['name', 'status', 'archived_at', 'intended_concentration_percent', 'total_batch_grams'],
  formula_ingredients: ['formula_id', 'sort_order', 'grams_as_weighed', 'percent_in_formula', 'source_type'],
  materials: ['name', 'unit', 'treat_as_solvent'],
  material_sources: ['stock_grams', 'price_per_gram', 'supplier_id', 'material_id'],
  production_batches: ['batch_label', 'produced_at', 'produced_grams'],
  stock_movements: ['date', 'created_at', 'movement_type', 'grams_delta'],
  formula_categories: ['name'],
};

const ALLOWED_FILTER_FIELDS: Record<string, string[]> = {
  formulas: ['id', 'name', 'category_id', 'status'],
  formula_ingredients: ['id', 'formula_id', 'material_id', 'source_type', 'source_formula_id'],
  materials: ['id', 'name', 'unit', 'treat_as_solvent'],
  material_sources: ['id', 'material_id', 'supplier_id'],
  production_batches: ['id', 'formula_id', 'batch_label'],
  stock_movements: ['id', 'material_source_id', 'movement_type', 'related_formula_id', 'production_batch_id'],
  formula_categories: ['id', 'name'],
};

const ALLOWED_SEARCH_FIELDS: Record<string, string[]> = {
  formulas: ['name'],
  materials: ['name'],
  formula_categories: ['name'],
};

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parsePositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value !== 'string') return fallback;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return fallback;
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasTokenConfigured()) {
    return res.status(500).json({ error: 'ASSISTANT_API_TOKEN not configured on server' });
  }
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { table, filter, search, search_field, order, ascending, limit, offset } = req.query as {
    table?: string; filter?: string; search?: string; search_field?: string;
    order?: string; ascending?: string; limit?: string; offset?: string;
  };

  if (!table || typeof table !== 'string') {
    return res.status(400).json({ error: 'Missing required query param: table' });
  }
  if (!(table in TABLE_COLUMNS)) {
    return res.status(400).json({ error: `Table not allowed. Allowed: ${Object.keys(TABLE_COLUMNS).join(', ')}` });
  }

  const safeLimit = Math.min(parsePositiveInt(limit, 50), 200);
  const safeOffset = parsePositiveInt(offset, 0);
  const sortAscending = parseBoolean(ascending, true);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured on server' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let query = supabase.from(table).select(TABLE_COLUMNS[table]).range(safeOffset, safeOffset + safeLimit - 1);

    if (filter && typeof filter === 'string') {
      const idx = filter.indexOf(':');
      if (idx === -1) return res.status(400).json({ error: 'Invalid filter format. Expected field:value' });
      const field = filter.slice(0, idx).trim();
      const value = filter.slice(idx + 1).trim();
      if (!field) return res.status(400).json({ error: 'Invalid filter: empty field' });
      if (!ALLOWED_FILTER_FIELDS[table]?.includes(field)) {
        return res.status(400).json({ error: `Filter field not allowed for ${table}: ${field}` });
      }
      query = query.eq(field, value);
    }

    if (search && typeof search === 'string') {
      const field = typeof search_field === 'string' && search_field.trim() ? search_field.trim() : 'name';
      if (!ALLOWED_SEARCH_FIELDS[table]?.includes(field)) {
        return res.status(400).json({ error: `Search field not allowed for ${table}: ${field}` });
      }
      query = query.ilike(field, `%${search.trim()}%`);
    }

    if (order && typeof order === 'string') {
      if (!ALLOWED_ORDER_FIELDS[table]?.includes(order)) {
        return res.status(400).json({ error: `Order field not allowed for ${table}: ${order}` });
      }
      query = query.order(order, { ascending: sortAscending });
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({
      table,
      limit: safeLimit,
      offset: safeOffset,
      count: Array.isArray(data) ? data.length : 0,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
