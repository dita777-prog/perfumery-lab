// Perfumery Lab — REST API endpoint for formulas
// GET /api/formulas — returns all formulas with ingredients
// GET /api/formulas?id=UUID — returns single formula with ingredients
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

  try {
    if (id) {
      // Single formula with ingredients
      const { data: formula, error: fErr } = await supabase
        .from('formulas')
        .select('*, formula_categories(name)')
        .eq('id', id)
        .single();
      if (fErr) throw new Error(fErr.message);

      const { data: ingredients, error: iErr } = await supabase
        .from('formula_ingredients')
        .select('*, materials(name, pyramid_role), material_dilutions(name, dilution_percent)')
        .eq('formula_id', id)
        .order('sort_order');
      if (iErr) throw new Error(iErr.message);

      return res.status(200).json({ ...formula, ingredients });
    } else {
      // All formulas
      const { data, error } = await supabase
        .from('formulas')
        .select('*, formula_categories(name)')
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);

      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
