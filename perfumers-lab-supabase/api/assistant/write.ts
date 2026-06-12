// POST /api/assistant/write
// Whitelisted write endpoint for the external assistant.
// Required env vars: ASSISTANT_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { checkAuth, hasTokenConfigured } from '../_auth.ts';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MOVEMENT_TYPES = ['restock', 'use', 'adjustment', 'production', 'correction'] as const;
const FORMULA_STATUSES = ['active', 'archived'] as const;

type Action =
  | 'create_stock_movement'
  | 'create_production_batch'
  | 'update_formula_notes'
  | 'update_formula_status';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function missingFields(data: any, required: string[]): string[] {
  const missing: string[] = [];
  for (const f of required) {
    const v = data?.[f];
    if (v === undefined || v === null || v === '') missing.push(f);
  }
  return missing;
}

async function writeAudit(supabase: SupabaseClient, action: string, data: any, resultId: string | null) {
  try {
    await supabase.from('assistant_audit_log').insert({
      action,
      data,
      result_id: resultId,
    });
  } catch {
    // intentional silent failure — write already succeeded
  }
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasTokenConfigured()) {
    return res.status(500).json({ error: 'ASSISTANT_API_TOKEN not configured on server' });
  }
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured on server' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  let body: any = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing JSON body' });
  }

  const action = body.action as Action | undefined;
  const data = body.data;
  if (!action) return res.status(400).json({ error: 'Missing field: action' });
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Missing field: data' });

  try {
    if (action === 'create_stock_movement') {
      const missing = missingFields(data, ['material_source_id', 'movement_type', 'grams_delta', 'date']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      if (!UUID_RE.test(data.material_source_id)) return res.status(400).json({ error: 'Invalid material_source_id (uuid)' });
      if (!MOVEMENT_TYPES.includes(data.movement_type)) {
        return res.status(400).json({ error: `movement_type must be one of ${MOVEMENT_TYPES.join(', ')}` });
      }
      if (typeof data.grams_delta !== 'number' || !Number.isFinite(data.grams_delta) || data.grams_delta === 0) {
        return res.status(400).json({ error: 'grams_delta must be a finite non-zero number' });
      }
      if (data.related_formula_id && !UUID_RE.test(data.related_formula_id)) {
        return res.status(400).json({ error: 'Invalid related_formula_id (uuid)' });
      }
      if (data.production_batch_id && !UUID_RE.test(data.production_batch_id)) {
        return res.status(400).json({ error: 'Invalid production_batch_id (uuid)' });
      }

      const insert: any = {
        material_source_id: data.material_source_id,
        movement_type: data.movement_type,
        grams_delta: data.grams_delta,
        date: data.date,
      };
      if (data.related_formula_id) insert.related_formula_id = data.related_formula_id;
      if (data.notes !== undefined) insert.notes = data.notes;
      if (data.batch_label !== undefined) insert.batch_label = data.batch_label;
      if (data.production_batch_id) insert.production_batch_id = data.production_batch_id;

      const { data: written, error } = await supabase
        .from('stock_movements')
        .insert(insert)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });

      await writeAudit(supabase, action, data, written?.id ?? null);
      return res.status(200).json({ ok: true, action, written });
    }

    if (action === 'create_production_batch') {
      const missing = missingFields(data, ['batch_label', 'formula_id', 'produced_grams', 'produced_at']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      if (!UUID_RE.test(data.formula_id)) return res.status(400).json({ error: 'Invalid formula_id (uuid)' });
      if (typeof data.produced_grams !== 'number' || !Number.isFinite(data.produced_grams) || data.produced_grams <= 0) {
        return res.status(400).json({ error: 'produced_grams must be a positive finite number' });
      }

      const insert: any = {
        batch_label: data.batch_label,
        formula_id: data.formula_id,
        produced_grams: data.produced_grams,
        produced_at: data.produced_at,
      };
      if (data.notes !== undefined) insert.notes = data.notes;

      const { data: written, error } = await supabase
        .from('production_batches')
        .insert(insert)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });

      await writeAudit(supabase, action, data, written?.id ?? null);
      return res.status(200).json({ ok: true, action, written });
    }

    if (action === 'update_formula_notes') {
      const missing = missingFields(data, ['formula_id', 'notes']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      if (!UUID_RE.test(data.formula_id)) return res.status(400).json({ error: 'Invalid formula_id (uuid)' });

      const { data: written, error } = await supabase
        .from('formulas')
        .update({ notes: data.notes })
        .eq('id', data.formula_id)
        .select()
        .single();
      if (error) {
        // If the notes column doesn't exist, surface a clear 400.
        const msg = error.message || '';
        if (/column.*notes.*does not exist/i.test(msg) || /notes/i.test(msg) && /schema/i.test(msg)) {
          return res.status(400).json({ error: 'formulas.notes column does not exist — action unavailable' });
        }
        return res.status(400).json({ error: msg });
      }

      await writeAudit(supabase, action, data, written?.id ?? null);
      return res.status(200).json({ ok: true, action, written });
    }

    if (action === 'update_formula_status') {
      const missing = missingFields(data, ['formula_id', 'status']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      if (!UUID_RE.test(data.formula_id)) return res.status(400).json({ error: 'Invalid formula_id (uuid)' });
      if (!FORMULA_STATUSES.includes(data.status)) {
        return res.status(400).json({ error: `status must be one of ${FORMULA_STATUSES.join(', ')}` });
      }

      const update: any = { status: data.status };
      if (data.status === 'archived') update.archived_at = new Date().toISOString();
      else update.archived_at = null;

      const { data: written, error } = await supabase
        .from('formulas')
        .update(update)
        .eq('id', data.formula_id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });

      await writeAudit(supabase, action, data, written?.id ?? null);
      return res.status(200).json({ ok: true, action, written });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
