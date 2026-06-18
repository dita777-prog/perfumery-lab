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

function hasTokenConfigured(): boolean {
  return !!process.env.ASSISTANT_API_TOKEN;
}

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

  const { id, name, category, category_id } = req.query;

  if (!id && !name) {
    return res.status(400).json({
      error: 'Missing required query param',
      hint: 'Provide either ?id=<formula_id> or ?name=<formula_name>'
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  let formulaQuery = supabase
    .from('formulas')
    .select(`
      id,
      name,
      commercial_name,
      category_id,
      status,
      archived_at,
      intended_concentration_percent,
      total_batch_grams
    `)
    .limit(10);

  if (id) {
    formulaQuery = formulaQuery.eq('id', id);
  } else if (name) {
    formulaQuery = formulaQuery.eq('name', name);
  }

  if (category_id) {
    formulaQuery = formulaQuery.eq('category_id', category_id);
  }

  const { data: formulas, error: formulaError } = await formulaQuery;

  if (formulaError) {
    return res.status(500).json({ error: formulaError.message });
  }

  if (!formulas || formulas.length === 0) {
    return res.status(404).json({ error: 'Formula not found' });
  }

  let matchedFormulas = formulas;

  if (category && matchedFormulas.length > 0) {
    const { data: categories, error: categoryError } = await supabase
      .from('formula_categories')
      .select('id, name');

    if (categoryError) {
      return res.status(500).json({ error: categoryError.message });
    }

    const categoryMap = new Map((categories || []).map((c: any) => [c.id, c.name]));
    matchedFormulas = matchedFormulas.filter((f: any) => categoryMap.get(f.category_id) === category);

    if (matchedFormulas.length === 0) {
      return res.status(404).json({
        error: 'Formula found, but not in requested category',
        requested_category: category
      });
    }
  }

  if (matchedFormulas.length > 1) {
    return res.status(409).json({
      error: 'Multiple formulas matched',
      hint: 'Use ?id=... or add ?category=... / ?category_id=...',
      matches: matchedFormulas
    });
  }

  const formula = matchedFormulas[0];

  const { data: categoryRow } = await supabase
    .from('formula_categories')
    .select('id, name')
    .eq('id', formula.category_id)
    .maybeSingle();

  const { data: ingredients, error: ingredientsError } = await supabase
    .from('formula_ingredients')
    .select(`
      id,
      formula_id,
      material_id,
      grams_as_weighed,
      neat_grams,
      percent_in_formula,
      source_type,
      materials (
        id,
        name,
        treat_as_solvent,
        status,
        notes_sensory,
        strength,
        tags
      )
    `)
    .eq('formula_id', formula.id)
    .order('percent_in_formula', { ascending: false });

  if (ingredientsError) {
    return res.status(500).json({ error: ingredientsError.message });
  }

  return res.status(200).json({
    formula: {
      ...formula,
      category: categoryRow || null
    },
    ingredients: ingredients || [],
    ingredient_count: (ingredients || []).length
  });
}
