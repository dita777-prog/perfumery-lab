// Shared auth helper for assistant API endpoints
// Required Vercel env vars: ASSISTANT_API_TOKEN
// Supports: Bearer token in Authorization header OR ?apikey= query param

export function checkAuth(req) {
  const token = process.env.ASSISTANT_API_TOKEN;
  if (!token) return false;
  // 1) Bearer token in Authorization header
  const auth = (req.headers['authorization'] || req.headers['Authorization'] || '');
  const headerToken = auth.replace('Bearer ', '').trim();
  if (headerToken === token) return true;
  // 2) ?apikey= query parameter (for external assistants that can't set headers)
  const queryApiKey = (req.query && req.query.apikey) || '';
  if (queryApiKey === token) return true;
  return false;
}

export function hasTokenConfigured() {
  return !!process.env.ASSISTANT_API_TOKEN;
}
