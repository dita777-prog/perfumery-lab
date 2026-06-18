import { createClient } from '@supabase/supabase-js';

type AuthMode = 'bearer' | 'query_apikey' | 'missing';

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
  if (req.query?.apikey) return 'query_apikey';
  return 'missing';
}

function checkAuth(req: any): boolean {
  const token = process.env.ASSISTANT_API_TOKEN;
  const queryApiKey = req.query?.apikey || '';
  if (!token) return false;
  if (getBearerToken(req) === token) return true;
  if (queryApiKey === token) return true;
  return false;
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

function parseFilters(filterValue: any): Array<{ field: string; value: string }> {
  if (!filterValue || typeof filterValue !== 'string') return [];
  return filterValue
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const idx = chunk.indexOf(':');
      if (idx === -1) return null;
      return {
        field: chunk.slice(0, idx).trim(),
        value: chunk.slice(idx + 1).trim(),
      };
    })
    .filter((item): item is { field: string; value: string } => !!item && !!item.field);
}

function normalizeRow(table: string, row: any): any {
  const base = {
    record_type: table,
    id: row?.id ?? null,
    name: null,
    commercial_name: null,
    status: null,
    category_id: null,
    formula_id: null,
    material_id: null,
    grams_as_weighed: null,
    neat_grams: null,
    percent_in_formula: null,
    source_type: null,
    treat_as_solvent: null,
    strength: null,
    tags: null,
    archived_at: null,
    intended_concentration_percent: null,
    total_batch_grams: null,
    supplier_id: null,
    stock_grams: null,
    batch_label: null,
    produced_grams: null,
    produced_at: null,
    movement_type: null,
    grams_delta: null,
    date: null,
    notes: null,
    assistant_price_per_gram: null,
    assistant_has_price: null,
  };

  if (table === 'formulas') {
    return {
      ...base,
      name: row?.name ?? null,
      commercial_name: row?.commercial_name ?? null,
      status: row?.status ?? null,
      category_id: row?.category_id ?? null,
      archived_at: row?.archived_at ?? null,
      intended_concentration_percent: row?.intended_concentration_percent ?? null,
      total_batch_grams: row?.total_batch_grams ?? null,
    };
  }

  if (table === 'formula_ingredients') {
    return {
      ...base,
      formula_id: row?.formula_id ?? null,
      material_id: row?.material_id ?? null,
      grams_as_weighed: row?.grams_as_weighed ?? null,
      neat_grams: row?.neat_grams ?? null,
      percent_in_formula: row?.percent_in_formula ?? null,
      source_type: row?.source_type ?? null,
    };
  }

  if (table === 'materials') {
    return {
      ...base,
      name: row?.name ?? null,
      status: row?.status ?? null,
      treat_as_solvent: row?.treat_as_solvent ?? null,
      strength: row?.strength ?? null,
      tags: row?.tags ?? null,
      assistant_price_per_gram: row?.assistant_price_per_gram ?? null,
      assistant_has_price: row?.assistant_has_price ?? null,
    };
  }

  if (table === 'material_sources') {
    const price = row?.price_per_gram ?? null;
    return {
      ...base,
      material_id: row?.material_id ?? null,
      supplier_id: row?.supplier_id ?? null,
      stock_grams: row?.stock_grams ?? null,
      assistant_price_per_gram: price,
      assistant_has_price: price !== null,
    };
  }

  if (table === 'production_batches') {
    return {
      ...base,
      formula_id: row?.formula_id ?? null,
      batch_label: row?.batch_label ?? null,
      produced_grams: row?.produced_grams ?? null,
      produced_at: row?.produced_at ?? null,
      notes: row?.notes ?? null,
    };
  }

  if (table === 'stock_movements') {
    return {
      ...base,
      movement_type: row?.movement_type ?? null,
      grams_delta: row?.grams_delta ?? null,
      formula_id: row?.related_formula_id ?? null,
      date: row?.date ?? null,
      notes: row?.notes ?? null,
    };
  }

  if (table === 'formula_categories') {
    return {
      ...base,
      name: row?.name ?? null,
    };
  }

  return { ...base, ...row };
}

const TABLE_COLUMNS: Record<string, string> = {
  formulas:
    'id, name, commercial_name, category_id, status, archived_at, intended_concentration_percent, total_batch_grams',
  formula_ingredients:
    'id, formula_id, material_id, grams_as_weighed, neat_grams, percent_in_formula, source_type',
  materials: 'id, name, treat_as_solvent, status, notes_sensory, strength, tags',
  material_sources: 'id, material_id, supplier_id, stock_grams, price_per_gram',
  production_batches: 'id, batch_label, formula_id, produced_grams, produced_at, notes',
  stock_movements: 'id, material_source_id, movement_type, grams_delta, related_formula_id, date, notes',
  formula_categories: 'id, name',
};

const ALLOWED_ORDER_FIELDS: Record<string, string[]> = {
  formulas: ['name', 'commercial_name', 'status', 'archived_at', 'intended_concentration_percent', 'total_batch_grams'],
  formula_ingredients: ['formula_id', 'material_id', 'grams_as_weighed', 'percent_in_formula'],
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

  if (req.method !== 'GET') {
    return sendError(req, res, 'read', 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  if (!hasTokenConfigured()) {
    return sendError(req, res, 'read', 503, 'TOKEN_NOT_CONFIGURED', 'API token not configured on server');
  }

  if (!checkAuth(req)) {
    return sendError(req, res, 'read', 401, 'UNAUTHORIZED', 'Unauthorized', {
      hint: 'Provide Authorization: Bearer <ASSISTANT_API_TOKEN> or ?apikey=<ASSISTANT_API_TOKEN>.',
    });
  }

  const { table, filter, search, search_field, order, ascending, limit, offset, exact, id } = req.query;

  if (!table || !TABLE_COLUMNS[table as string]) {
    return sendError(req, res, 'read', 400, 'INVALID_TABLE', 'Invalid or missing table', {
      allowed_tables: Object.keys(TABLE_COLUMNS),
    });
  }

  const tableName = table as string;
  const limitNum = Math.min(parseInt(limit as string) || 50, 200);
  const offsetNum = parseInt(offset as string) || 0;
  const exactMatch = exact === 'true';

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  if (tableName === 'materials') {
    let query = supabase
      .from('materials')
      .select(
        'id, name, treat_as_solvent, status, notes_sensory, strength, tags, material_sources(price_per_gram, purchase_price, purchase_quantity_grams)',
        { count: 'exact' }
      );

    if (id) {
      query = query.eq('id', id);
    }

    for (const item of parseFilters(filter)) {
      query = query.eq(item.field, item.value);
    }

    if (search && search_field) {
      query = exactMatch
        ? query.eq(search_field as string, search)
        : query.ilike(search_field as string, `%${search}%`);
    } else if (search) {
      query = exactMatch ? query.eq('name', search) : query.ilike('name', `%${search}%`);
    }

    if (order) {
      const allowedFields = ALLOWED_ORDER_FIELDS.materials || [];
      if (allowedFields.includes(order as string)) {
        query = query.order(order as string, { ascending: ascending !== 'false' });
      }
    }

    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      return sendError(req, res, 'read', 500, 'SUPABASE_QUERY_FAILED', error.message, {
        table: tableName,
      });
    }

    const normalized = (data || []).map((m: any) => {
      const sources: any[] = m.material_sources || [];
      const prices: number[] = sources
        .map((s: any) => {
          if (s.price_per_gram != null) return parseFloat(s.price_per_gram);
          if (s.purchase_price != null && s.purchase_quantity_grams != null) {
            const pp = parseFloat(s.purchase_price);
            const pq = parseFloat(s.purchase_quantity_grams);
            if (!isNaN(pp) && !isNaN(pq) && pq > 0) return pp / pq;
          }
          return null;
        })
        .filter((p): p is number => p !== null && !isNaN(p) && p > 0);

      const assistant_price_per_gram = prices.length > 0 ? Math.min(...prices) : null;

      return normalizeRow('materials', {
        ...m,
        assistant_price_per_gram,
        assistant_has_price: assistant_price_per_gram !== null,
      });
    });

    return sendSuccess(req, res, 'read', normalized, {
      table: tableName,
      count: count ?? normalized.length,
      limit: limitNum,
      offset: offsetNum,
    });
  }

  const columns = TABLE_COLUMNS[tableName];
  let query = supabase.from(tableName).select(columns, { count: 'exact' });

  if (id) {
    query = query.eq('id', id);
  }

  for (const item of parseFilters(filter)) {
    query = query.eq(item.field, item.value);
  }

  if (search && search_field) {
    query = exactMatch
      ? query.eq(search_field as string, search)
      : query.ilike(search_field as string, `%${search}%`);
  } else if (search) {
    query = exactMatch ? query.eq('name', search) : query.ilike('name', `%${search}%`);
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
    return sendError(req, res, 'read', 500, 'SUPABASE_QUERY_FAILED', error.message, {
      table: tableName,
    });
  }

  const normalized = (data || []).map((row: any) => normalizeRow(tableName, row));

  return sendSuccess(req, res, 'read', normalized, {
    table: tableName,
    count: count ?? normalized.length,
    limit: limitNum,
    offset: offsetNum,
  });
}
