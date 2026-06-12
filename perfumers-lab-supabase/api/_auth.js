// Shared auth helper for assistant API endpoints (JS version for Node.js runtime)
// Required Vercel env vars: ASSISTANT_API_TOKEN

export function checkAuth(req) {
  const auth = (req.headers['authorization'] || req.headers['Authorization'] || '');
  const token = auth.replace('Bearer ', '').trim();
  return !!process.env.ASSISTANT_API_TOKEN && token === process.env.ASSISTANT_API_TOKEN;
}

export function hasTokenConfigured() {
  return !!process.env.ASSISTANT_API_TOKEN;
}
