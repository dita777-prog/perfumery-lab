// Perfumery Lab — MCP server endpoint for Perplexity
// Vercel Serverless Function: /api/mcp

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// MCP tools definition
const TOOLS = [
  {
    name: 'get_materials',
    description: 'Vrátí seznam všech parfémových materiálů v inventáři včetně jejich vlastností (čichová rodina, role v pyramidě, síla, stav skladu).',
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
      properties: {
        formula_id: { type: 'string', description: 'UUID formule' }
      },
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
    description: 'Vrátí materiály, kterým dochází zásoba (stock_grams pod reorder_threshold_grams).',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_tests',
    description: 'Vrátí záznamy testů formulí včetně hodnocení (intenzita, longevita, rozhodnutí).',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_decisions',
    description: 'Vrátí záznamy rozhodnutí v laboratoři (co bylo rozhodnuto, proč, co bylo zamítnuto).',
    inputSchema: { type: 'object', properties: {}, required: [] }
  }
];

async function callTool(name, args) {
  switch (name) {
    case 'get_materials': {
      const { data, error } = await supabase
        .from('materials')
        .select('*, olfactive_families(name)')
        .order('name');
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_formulas': {
      const { data, error } = await supabase
        .from('formulas')
        .select('*, formula_categories(name)')
        .order('updated_at', { ascending: false });
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
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_low_stock_materials': {
      const { data, error } = await supabase
        .from('material_sources')
        .select('*, materials(name)')
        .not('reorder_threshold_grams', 'is', null);
      if (error) throw new Error(error.message);
      return data.filter(s => (s.stock_grams || 0) <= (s.reorder_threshold_grams || 0));
    }
    case 'get_tests': {
      const { data, error } = await supabase
        .from('tests')
        .select('*, formulas(name, version)')
        .order('test_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_decisions': {
      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }
    default:
      throw new Error(`Neznámý nástroj: ${name}`);
  }
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  // MCP: initialize
  if (body.method === 'initialize') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'perfumery-lab', version: '1.0.0' }
      }
    });
  }

  // MCP: tools/list
  if (body.method === 'tools/list') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id: body.id,
      result: { tools: TOOLS }
    });
  }

  // MCP: tools/call
  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params;
    try {
      const result = await callTool(name, args || {});
      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      });
    } catch (err) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32603, message: err.message }
      });
    }
  }

  return res.status(400).json({ error: 'Unknown method' });
};
