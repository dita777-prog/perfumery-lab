// Perfumery Lab — MCP server endpoint for Perplexity
// Vercel Serverless Function: /api/mcp
// ESModule + correct Content-Type headers

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TOOLS = [
  {
    name: 'get_materials',
    description: 'Vrátí seznam všech parfémových materiálů včetně jejich vlastností (čichová rodina, role v pyramidě, síla, stav skladu).',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_formulas',
    description: 'Vrátí seznam všech parfémových formulí (recepty) včetně verze, statusu, kategorie a poznámek.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_formula_ingredients',
    description: 'Vrátí ingredience konkrétní formule podle jejího ID.',
    inputSchema: {
      type: 'object',
      properties: { formula_id: { type: 'string', description: 'UUID formule' } },
      required: ['formula_id']
    }
  },
  {
    name: 'get_suppliers',
    description: 'Vrátí seznam dodavatelů parfémových materiálů.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_low_stock_materials',
    description: 'Vrátí materiály, kterým dochází zásoba.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_tests',
    description: 'Vrátí záznamy testů formulí včetně hodnocení.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_decisions',
    description: 'Vrátí záznamy rozhodnutí v laboratoři.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  }
];

async function callTool(name, args) {
  switch (name) {
    case 'get_materials': {
      const { data, error } = await supabase.from('materials').select('*, olfactive_families(name)').order('name');
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_formulas': {
      const { data, error } = await supabase.from('formulas').select('*, formula_categories(name)').order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_formula_ingredients': {
      const { data, error } = await supabase.from('formula_ingredients').select('*, materials(name, pyramid_role), material_dilutions(name, dilution_percent)').eq('formula_id', args.formula_id).order('sort_order');
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_suppliers': {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_low_stock_materials': {
      const { data, error } = await supabase.from('material_sources').select('*, materials(name)').not('reorder_threshold_grams', 'is', null);
      if (error) throw new Error(error.message);
      return data.filter(s => (s.stock_grams || 0) <= (s.reorder_threshold_grams || 0));
    }
    case 'get_tests': {
      const { data, error } = await supabase.from('tests').select('*, formulas(name, version)').order('test_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_decisions': {
      const { data, error } = await supabase.from('decisions').select('*').order('date', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }
    default:
      throw new Error(`Neznámý nástroj: ${name}`);
  }
}

function jsonReply(res, data, status = 200) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Mcp-Session-Id', 'perfumery-lab-session');
  res.status(status).json(data);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return jsonReply(res, { name: 'perfumery-lab', version: '1.0.0', protocol: 'MCP' });
  }

  if (req.method !== 'POST') {
    return jsonReply(res, { error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return jsonReply(res, { error: 'Invalid JSON' }, 400);
  }

  if (!body || !body.method) {
    return jsonReply(res, { error: 'Missing method' }, 400);
  }

  // Notifications — no response body needed
  if (body.method.startsWith('notifications/')) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).end();
  }

  // initialize
  if (body.method === 'initialize') {
    return jsonReply(res, {
      jsonrpc: '2.0', id: body.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'perfumery-lab', version: '1.0.0' }
      }
    });
  }

  // tools/list
  if (body.method === 'tools/list') {
    return jsonReply(res, {
      jsonrpc: '2.0', id: body.id,
      result: { tools: TOOLS }
    });
  }

  // tools/call
  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params;
    try {
      const result = await callTool(name, args || {});
      return jsonReply(res, {
        jsonrpc: '2.0', id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      });
    } catch (err) {
      return jsonReply(res, {
        jsonrpc: '2.0', id: body.id,
        error: { code: -32603, message: err.message }
      });
    }
  }

  return jsonReply(res, { jsonrpc: '2.0', id: body.id || null, result: {} });
}
