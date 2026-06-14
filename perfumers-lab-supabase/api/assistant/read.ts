// GET /api/assistant/read?table=<name>&filter=field:value&search=<term>&search_field=name&order=name&ascending=true&limit=50&offset=0
// Whitelisted read endpoint for the external assistant.
// Auth: Bearer token via Authorization header OR ?apikey= query param
// Required env vars: ASSISTANT_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js';

function checkAuth(req: any): boolean {
  const headerAuth = req.headers['authorization'] || req.headers['Authorization'] || '';
  const queryApiKey = req.query?.apikey || '';
  const token = process.env.ASSISTANT_API_TOKEN;
  if (!token) return false;
  if (headerAuth === `Bearer ${token}`) return true;
  if (queryApiKey === token) return true;
  return false;
}

function hasTokenConfigured(): boolean { return !!process.env.ASSISTANT_API_TOKEN; }

const TABLE_COLUMNS: Record<string, string> = {
  formulas: 'id, name, category_id, status, archived_at, intended_concentration_percent, total_batch_grams',
  formula_ingredients: 'id, formula_id, material_id, grams_as_weighed, neat_grams, percent_in_formula, source_type',
  materials: 'id, name, treat_as_solvent, status, notes_sensory, strength, tags',
  material_sources: 'id, material_id, supplier_id, stock_grams, price_per_gram',
  production_batches: 'id, batch_label, formula_id, produced_grams, produced_at, notes',
  stock_movements: 'id, material_source_id, movement_type, grams_delta, related_formula_id, date, notes',
  formula_categories: 'id, name',
};

const ALLOWED_ORDER_FIELDS: Record<string, string[]> = {
  formulas: ['name', 'status', 'archived_at', 'intended_concentration_percent', 'total_batch_grams'],
  formula_ingredients: ['formula_id', 'material_id', 'grams_as_weighed'],
  materials: ['name', 'status', 'strength'],
  material_sources: ['stock_grams', 'price_per_gram', 'supplier_id', 'material_id'],
  production_batches: ['produced_at', 'batch_label', 'produced_grams'],
  stock_movements: ['date', 'movement_type', 'grams_delta'],
  formula_categories: ['name'],
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasTokenConfigured()) {
    return res.status(503).json({ error: 'API token not configured on server' });
  }

  if (!checkAuth(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      hint: 'Provide Bearer token in Authorization header or ?apikey= query param'
    });
  }

  const { table, filter, search, search_field, order, ascending, limit, offset } = req.query;

  if (!table || !TABLE_COLUMNS[table as string]) {
    return res.status(400).json({
      error: 'Invalid or missing table',
      allowed_tables: Object.keys(TABLE_COLUMNS)
    });
  }

  const tableName = table as string;
  const columns = TABLE_COLUMNS[tableName];
  const limitNum = Math.min(parseInt(limit as string) || 50, 200);
  const offsetNum = parseInt(offset as string) || 0;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  let query = supabase.from(tableName).select(columns, { count: 'exact' });

  if (filter) {
    const parts = (filter as string).split(':');
    if (parts.length === 2) {
      query = query.eq(parts[0].trim(), parts[1].trim());
    }
  }

  if (search && search_field) {
    query = query.ilike(search_field as string, `%${search}%`);
  } else if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (order) {
    const allowedFields = ALLOWED_ORDER_FIELDS[tableName] || [];
    if (allowedFields.includes(order as string)) {
      query = query.order(order as string, { ascending: ascending !== 'false' });
    }
  }

  query = query.range(offsetNum, offsetNum + limitNum - 1);

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    table: tableName,
    count,
    limit: limitNum,
    offset: offsetNum,
    data
  });
}
