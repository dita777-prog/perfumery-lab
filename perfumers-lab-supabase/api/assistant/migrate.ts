// GET /api/assistant/migrate
// Returns the SQL to run in Supabase SQL editor to create the audit log table.
export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }
  const sql = `-- Run this once in the Supabase SQL editor.
CREATE TABLE IF NOT EXISTS assistant_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  data jsonb,
  result_id text,
  created_at timestamptz DEFAULT now()
);
GRANT ALL ON assistant_audit_log TO anon, authenticated;
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(sql);
}
