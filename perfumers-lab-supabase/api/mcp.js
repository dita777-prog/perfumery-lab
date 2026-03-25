// Perfumery Lab - MCP Streamable HTTP server for Perplexity
// Vercel Serverless Function: /api/mcp
const { createClient } = require('@supabase/supabase-js');

// Initialize supabase inside the handler to prevent early crashes if env vars are missing
let supabase;

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
      properties: {
        formula_id: { type: 'string', description: 'Formula UUID' }
      },
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
  },
  {
    name: 'create_formula',
    description: 'Creates a new fragrance formula or accord.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the formula' },
        version: { type: 'string', description: 'Version string (e.g. v1, 1.0)' },
        status: { type: 'string', enum: ['draft', 'testing', 'approved'], description: 'Initial status' },
        notes: { type: 'string', description: 'General notes' }
      },
      required: ['name']
    }
  },
  {
    name: 'add_formula_ingredient',
    description: 'Adds a new ingredient (raw material OR sub-formula/accord) to a formula.',
    inputSchema: {
      type: 'object',
      properties: {
        formula_id: { type: 'string', description: 'Target Formula UUID' },
        source_type: { type: 'string', enum: ['material', 'formula'], description: 'material = raw material, formula = sub-formula/accord' },
        material_id: { type: 'string', description: 'Material UUID' },
        source_formula_id: { type: 'string', description: 'Sub-formula UUID' },
        dilution_id: { type: 'string', description: 'Dilution UUID' },
        grams_as_weighed: { type: 'number' },
        neat_grams: { type: 'number' },
        notes: { type: 'string' }
      },
      required: ['formula_id', 'source_type', 'grams_as_weighed']
    }
  },
  {
    name: 'update_formula_ingredient',
    description: 'Updates the weight/amount of an EXISTING ingredient row.',
    inputSchema: {
      type: 'object',
      properties: {
        ingredient_id: { type: 'string' },
        grams_as_weighed: { type: 'number' },
        neat_grams: { type: 'number' },
        notes: { type: 'string' }
      },
      required: ['ingredient_id', 'grams_as_weighed']
    }
  },
  {
    name: 'delete_formula_ingredient',
    description: 'Removes an ingredient row from a formula.',
    inputSchema: {
      type: 'object',
      properties: {
        ingredient_id: { type: 'string' }
      },
      required: ['ingredient_id']
    }
  },
  {
    name: 'update_formula',
    description: 'Updates an existing formula properties.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        version: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'testing', 'approved'] },
        notes: { type: 'string' }
      },
      required: ['id']
    }
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
      const { data, error } = await supabase
        .from('formula_ingredients')
        .select('*, materials(name, pyramid_role), material_dilutions(name, dilution_percent)')
        .eq('formula_id', args.formula_id)
        .order('sort_order');
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
    case 'create_formula': {
      const { data, error } = await supabase.from('formulas').insert([args]).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    case 'add_formula_ingredient': {
      const payload = {
        formula_id: args.formula_id,
        source_type: args.source_type || 'material',
        material_id: args.material_id || null,
        source_formula_id: args.source_formula_id || null,
        dilution_id: args.dilution_id || null,
        grams_as_weighed: String(args.grams_as_weighed ?? 0),
        neat_grams: String(args.neat_grams ?? args.grams_as_weighed ?? 0),
        notes: args.notes || null,
      };
      const { data, error } = await supabase.from('formula_ingredients').insert([payload]).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    case 'update_formula_ingredient': {
      const updates = {};
      if (args.grams_as_weighed !== undefined) updates.grams_as_weighed = String(args.grams_as_weighed);
      if (args.neat_grams !== undefined) {
        updates.neat_grams = String(args.neat_grams);
      } else if (args.grams_as_weighed !== undefined) {
        updates.neat_grams = String(args.grams_as_weighed);
      }
      if (args.notes !== undefined) updates.notes = args.notes;
      const { data, error } = await supabase
        .from('formula_ingredients')
        .update(updates)
        .eq('id', args.ingredient_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    case 'delete_formula_ingredient': {
      const { error } = await supabase.from('formula_ingredients').delete().eq('id', args.ingredient_id);
      if (error) throw new Error(error.message);
      return { deleted: true, id: args.ingredient_id };
    }
    case 'update_formula': {
      const { id, ...updates } = args;
      const { data, error } = await supabase.from('formulas').update(updates).eq('id', id).select().single();
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
  const id = msg.id !== undefined ? msg.id : null;
  if (msg.method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO } };
  }
  if (msg.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (msg.method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }
  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params || {};
    try {
      const result = await callTool(name, args || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false } };
    } catch (err) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err.message }], isError: true } };
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }
    supabase = createClient(url, key);
  }

  const sessionId = req.headers['mcp-session-id'] || genId();
  res.setHeader('Mcp-Session-Id', sessionId);

  if (req.method === 'GET') {
    return res.status(200).json({ name: SERVER_INFO.name, version: SERVER_INFO.version });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of messages) {
    const resp = await processMessage(msg);
    if (resp) responses.push(resp);
  }

  if (responses.length === 1 && !Array.isArray(body)) {
    return res.status(200).json(responses[0]);
  }
  return res.status(200).json(responses);
};
