import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const updates = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.categoryId !== undefined) updates.category_id = body.categoryId;
      if (body.status !== undefined) updates.status = body.status;
      if (body.archivedAt !== undefined) updates.archived_at = body.archivedAt;
      if (body.formulaNotes !== undefined) updates.formula_notes = body.formulaNotes;
      if (body.version !== undefined) updates.version = body.version;
      if (body.intendedConcentrationPercent !== undefined) updates.intended_concentration_percent = body.intendedConcentrationPercent;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('formulas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('formulas')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('formulas')
        .select('*, formula_categories(name)')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
