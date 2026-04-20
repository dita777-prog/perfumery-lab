// GET /api/assistant/read?table=<name>&filter=field:value
// Whitelisted read endpoint for the external assistant.
// Required env vars: ASSISTANT_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js';
import { checkAuth, hasTokenConfigured } from '../_auth';

const TABLE_COLUMNS: Record<string, string> = {
  formulas: 'id, name, category_id, status, archived_at, intended_concentration_percent, total_batch_grams',
  formula_ingredients: 'id, formula_id, material_id, grams_as_weighed, neat_grams, percent_in_formula',
  materials: 'id, name, treat_as_solvent, unit',
  material_sources: 'id, material_id, supplier_id, stock_grams, price_per_gram',
  production_batches: 'id, batch_label, formula_id, produced_grams, produced_at, notes',
  stock_movements: 'id, material_source_id, movement_type, grams_delta, related_formula_id, date, notes, batch_label, production_batch_id, created_at',
  formula_categories: 'id, name',
};

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  const { table, filter } = req.query as { table?: string; filter?: string };
  if (!table || typeof table !== 'string') {
    return res.status(400).json({ error: 'Missing required query param: table' });
  }
  if (!(table in TABLE_COLUMNS)) {
    return res.status(400).json({ error: `Table not allowed. Allowed: ${Object.keys(TABLE_COLUMNS).join(', ')}` });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured on server' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let query = supabase.from(table).select(TABLE_COLUMNS[table]);

    if (filter && typeof filter === 'string') {
      const idx = filter.indexOf(':');
      if (idx === -1) {
        return res.status(400).json({ error: 'Invalid filter format. Expected field:value' });
      }
      const field = filter.slice(0, idx).trim();
      const value = filter.slice(idx + 1).trim();
      if (!field) return res.status(400).json({ error: 'Invalid filter: empty field' });
      query = query.eq(field, value);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
