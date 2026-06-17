import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function toDateOnly(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function ingredientName(row) {
  return row?.materials?.name || row?.material_dilutions?.name || row?.name || 'ingredient';
}

function ingredientPercent(row) {
  const direct = toNumber(pick(row, ['percent', 'percentage', 'amount_percent', 'share_percent']));
  if (direct !== null) return direct;
  const gramsPer100g = toNumber(pick(row, ['grams_per_100g', 'gramsPer100g']));
  if (gramsPer100g !== null) return gramsPer100g;
  return null;
}

function ingredientMaterialId(row) {
  return (
    pick(row, ['material_id', 'materialId']) ||
    row?.materials?.id ||
    row?.material_dilutions?.material_id ||
    row?.material_dilutions?.materialId ||
    row?.materialDilutions?.material_id ||
    row?.materialDilutions?.materialId ||
    null
  );
}

function sourceStock(row) {
  return toNumber(pick(row, ['stock_grams', 'stockGrams'])) || 0;
}

function chooseBestSource(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return [...rows].sort((a, b) => sourceStock(b) - sourceStock(a))[0];
}

async function listBatches(req, res) {
  const id = req.query?.id;
  let query = supabase
    .from('production_batches')
    .select('*, formulas(name)')
    .order('produced_at', { ascending: false });

  if (id) query = query.eq('id', id).limit(1);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json(id ? data?.[0] ?? null : data ?? []);
}

async function createBatch(req, res) {
  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const batchLabel = pick(body, ['batchLabel', 'batch_label']);
  const formulaId = pick(body, ['formulaId', 
