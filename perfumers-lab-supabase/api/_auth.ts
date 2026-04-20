// Shared auth helper for assistant API endpoints.
// Required Vercel env vars: ASSISTANT_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY
export function checkAuth(req: any): boolean {
  const auth = (req.headers['authorization'] || req.headers['Authorization'] || '') as string;
  const token = auth.replace('Bearer ', '').trim();
  return !!process.env.ASSISTANT_API_TOKEN && token === process.env.ASSISTANT_API_TOKEN;
}

export function hasTokenConfigured(): boolean {
  return !!process.env.ASSISTANT_API_TOKEN;
}
