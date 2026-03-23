// Perfumery Lab — MCP server endpoint for Perplexity
// Vercel Serverless Function: /api/mcp

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TOOLS = [
  {
    name: 'get_materials',
    description: 'Vrátí seznam všech parfémových materiálů včetně jejich vlastností.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_formulas',
    description: 'Vrátí seznam všech parfémových formulí včetně verze a statusu.',
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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Mcp-Session-Id');
}

async function handleJsonRpc(body) {
  if (!body || !body.method) return null;
  if (body.method.startsWith('notifications/')) return null;

  if (body.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'perfumery-lab', version: '1.0.0' }
      }
    };
  }

  if (body.method === 'tools/list') {
    return { jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } };
  }

  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params;
    try {
      const result = await callTool(name, args || {});
      return {
        jsonrpc: '2.0', id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      };
    } catch (err) {
      return { jsonrpc: '2.0', id: body.id, error: { code: -32603, message: err.message } };
    }
  }

  return { jsonrpc: '2.0', id: body.id || null, result: {} };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'DELETE') return res.status(200).end();

  // GET — SSE stream, send 'endpoint' event so Perplexity knows where to POST
  if (req.method === 'GET') {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'perfumery-lab.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const postUrl = `${proto}://${host}/api/mcp`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`event: endpoint\ndata: ${JSON.stringify({ uri: postUrl })}\n\n`);
    return res.end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'application/json');

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (Array.isArray(body)) {
    const responses = [];
    for (const msg of body) {
      const response = await handleJsonRpc(msg);
      if (response !== null) responses.push(response);
    }
    if (responses.length === 0) return res.status(200).end();
    return res.status(200).json(responses);
  }

  const response = await handleJsonRpc(body);
  if (response === null) return res.status(200).end();
  return res.status(200).json(response);
}
