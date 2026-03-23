// Perfumery Lab — MCP Streamable HTTP server for Perplexity
// Vercel Serverless Function: /api/mcp
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SERVER_INFO = { name: 'perfumery-lab', version: '1.0.0' };
const PROTOCOL_VERSION = '2025-03-26';

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const TOOLS = [
  {
    name: 'get_materials',
    description: 'Returns a list of all fragrance materials with their properties.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_formulas',
    description: 'Returns a list of all fragrance formulas including version and status.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_formula_ingredients',
    description: 'Returns ingredients of a specific formula by its ID.',
    inputSchema: {
      type: 'object',
      properties: { formula_id: { type: 'string', description: 'Formula UUID' } },
      required: ['formula_id']
    }
  },
  {
    name: 'get_suppliers',
    description: 'Returns a list of fragrance material suppliers.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_low_stock_materials',
    description: 'Returns materials that are running low on stock.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_tests',
    description: 'Returns formula test records including ratings.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_decisions',
    description: 'Returns laboratory decision records.',
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
      throw new Error(`Unknown tool: ${name}`);
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

async function processMessage(msg) {
  if (!msg || typeof msg !== 'object' || !msg.method) return null;
  if (msg.method.startsWith('notifications/')) return null;

  const id = msg.id !== undefined ? msg.id : null;

  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO
      }
    };
  }
  if (msg.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (msg.method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }
  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params || {};
    try {
      const result = await callTool(name, args || {});
      return {
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: err.message }], isError: true }
      };
    }
  }
  if (id !== null && id !== undefined) return { jsonrpc: '2.0', id, result: {} };
  return null;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'DELETE') return res.status(200).end();

  const sessionId = req.headers['mcp-session-id'] || genId();
  res.setHeader('Mcp-Session-Id', sessionId);

  if (req.method === 'GET') {
    const accept = (req.headers['accept'] || '');
    if (accept.includes('text/event-stream')) {
      // GET SSE endpoint - return empty stream
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200);
      res.write(': ping\n\n');
      return res.end();
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      name: SERVER_INFO.name, version: SERVER_INFO.version,
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} }
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body) return res.status(400).json({ error: 'Empty body' });

  const accept = (req.headers['accept'] || '');
  const wantsSSE = accept.includes('text/event-stream');

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of messages) {
    const resp = await processMessage(msg);
    if (resp) responses.push(resp);
  }

  if (responses.length === 0) return res.status(202).end();

  if (wantsSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200);
    for (const resp of responses) {
      res.write('event: message\n');
      res.write('data: ' + JSON.stringify(resp) + '\n\n');
    }
    return res.end();
  }

  res.setHeader('Content-Type', 'application/json');
  if (responses.length === 1 && !Array.isArray(body)) {
    return res.status(200).json(responses[0]);
  }
  return res.status(200).json(responses);
}
