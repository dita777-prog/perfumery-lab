import { createClient } from '@supabase/supabase-js';

type AuthMode = 'bearer' | 'missing' | 'query_apikey_not_allowed';

function hasTokenConfigured(): boolean {
  return !!process.env.ASSISTANT_API_TOKEN;
}

function getBearerToken(req: any): string {
  const headerAuth = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!headerAuth.startsWith('Bearer ')) return '';
  return headerAuth.slice('Bearer '.length).trim();
}

function getAuthMode(req: any): AuthMode {
  const bearer = getBearerToken(req);
  if (bearer) return 'bearer';
  if (req.query?.apikey) return 'query_apikey_not_allowed';
  return 'missing';
}

function checkAuth(req: any): boolean {
  const token = process.env.ASSISTANT_API_TOKEN;
  if (!token) return false;
  return getBearerToken(req) === token;
}

function buildRequestUrl(req: any): string {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'unknown-host';
  return `${proto}://${host}${req.url || ''}`;
}

function baseMeta(req: any, endpoint: string, extra: Record<string, any> = {}) {
  return {
    endpoint,
    request_url: buildRequestUrl(req),
    auth_mode: getAuthMode(req),
    ...extra,
  };
}

function sendError(
  req: any,
  res: any,
  endpoint: string,
  status: number,
  code: string,
  message: string,
  details: Record<string, any> = {}
) {
  return res.status(status).json({
    ok: false,
    data: null,
    meta: baseMeta(req, endpoint, { status }),
    error: {
      code,
      message,
      ...details,
    },
  });
}

function sendSuccess(
  req: any,
  res: any,
  endpoint: string,
  data: any,
  meta: Record<string, any> = {}
) {
  return res.status(200).json({
    ok: true,
    data,
    meta: baseMeta(req, endpoint, { status: 200, ...meta }),
    error: null,
  });
}

function normalizeFormula(formula: any, categoryName: string | null) {
  return {
    record_type: 'formula',
    id: formula?.id ?? null,
    name: formula?.name ?? null,
    commercial_name: formula?.commercial_name ?? null,
    status: formula?.status ?? null,
    category_id: formula?.category_id ?? null,
    category_name: categoryName ?? null,
    archived_at: formula?.archived_at ?? null,
    intended_concentration_percent: formula?.intended_concentration_percent ?? null,
    total_batch_grams: formula?.total_batch_grams ?? null,
    assistant_price_per_gram: null,
    assistant_has_price: null,
  };
}

function normalizeIngredient(row: any) {
  return {
    record_type: 'formula_ingredient',
    id: row?.id ?? null,
    formula_id: row?.formula_id ?? null,
    material_id: row?.material_id ?? null,
    material_name: row?.materials?.name ?? null,
    grams_as_weighed: row?.grams_as_weighed ?? null,
    neat_grams: row?.neat_grams ?? null,
    percent_in_formula: row?.percent_in_formula ?? null,
    source_type: row?.source_type ?? null,
    assistant_price_per_gram: null,
    assistant_has_price: null,
    material: row?.materials
      ? {
          id: row.materials.id ?? null,
          name: row.materials.name ?? null,
          treat_as_solvent: row.materials.treat_as_solvent ?? null,
          status: row.materials.status ?? null,
          strength: row.materials.strength ?? null,
          tags: row.materials.tags ?? null,
        }
      : null,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return sendError(req, res, 'formula-detail', 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  if (!hasTokenConfigured()) {
    return sendError(req, res, 'formula-detail', 503, 'TOKEN_NOT_CONFIGURED', 'API token not configured on server');
  }

  if (!checkAuth(req)) {
    const authMode = getAuthMode(req);
    return sendError(req, res, 'formula-detail', 401, 'UNAUTHORIZED', 'Unauthorized', {
      hint:
        authMode === 'query_apikey_not_allowed'
          ? 'Query apikey is no longer supported. Use Authorization: Bearer <ASSISTANT_API_TOKEN>.'
          : 'Provide Authorization: Bearer <ASSISTANT_API_TOKEN>.',
    });
  }

  const { id, name, category, category_id } = req.query;

  if (!id && !name) {
    return sendError(
      req,
      res,
      'formula-detail',
      400,
      'MISSING_LOOKUP',
      'Provide either ?id=<formula_id> or ?name=<formula_name>'
    );
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  let formulaQuery = supabase
    .from('formulas')
    .select(
      'id, name, commercial_name, category_id, status, archived_at, intended_concentration_percent, total_batch_grams'
    )
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
    return sendError(req, res, 'formula-detail', 500, 'SUPABASE_QUERY_FAILED', formulaError.message, {
      stage: 'formula_lookup',
    });
  }

  if (!formulas || formulas.length === 0) {
    return sendError(req, res, 'formula-detail', 404, 'FORMULA_NOT_FOUND', 'Formula not found');
  }

  const { data: categories, error: categoriesError } = await supabase
    .from('formula_categories')
    .select('id, name');

  if (categoriesError) {
    return sendError(req, res, 'formula-detail', 500, 'SUPABASE_QUERY_FAILED', categoriesError.message, {
      stage: 'category_lookup',
    });
  }

  const categoryMap = new Map((categories || []).map((c: any) => [c.id, c.name]));

  let matched = formulas;

  if (category) {
    matched = matched.filter((f: any) => categoryMap.get(f.category_id) === category);
  }

  if (matched.length === 0) {
    return sendError(
      req,
      res,
      'formula-detail',
      404,
      'FORMULA_NOT_FOUND_IN_CATEGORY',
      'Formula found, but not in requested category',
      { requested_category: category }
    );
  }

  if (matched.length > 1) {
    return sendError(
      req,
      res,
      'formula-detail',
      409,
      'MULTIPLE_FORMULAS_MATCHED',
      'Multiple formulas matched. Narrow the query with id or category.',
      {
        matches: matched.map((f: any) => ({
          id: f.id,
          name: f.name,
          commercial_name: f.commercial_name,
          category_id: f.category_id,
          category_name: categoryMap.get(f.category_id) || null,
          status: f.status,
        })),
      }
    );
  }

  const formula = matched[0];
  const categoryName = categoryMap.get(formula.category_id) || null;

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
        strength,
        tags
      )
    `)
    .eq('formula_id', formula.id)
    .order('percent_in_formula', { ascending: false });

  if (ingredientsError) {
    return sendError(req, res, 'formula-detail', 500, 'SUPABASE_QUERY_FAILED', ingredientsError.message, {
      stage: 'ingredient_lookup',
    });
  }

  const normalizedFormula = normalizeFormula(formula, categoryName);
  const normalizedIngredients = (ingredients || []).map((row: any) => normalizeIngredient(row));

  return sendSuccess(
    req,
    res,
    'formula-detail',
    {
      formula: normalizedFormula,
      ingredients: normalizedIngredients,
    },
    {
      formula_id: formula.id,
      ingredient_count: normalizedIngredients.length,
    }
  );
}
