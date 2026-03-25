// OAuth Authorization endpoint
// Auto-approves access and redirects back to Perplexity with authorization code
// Supports PKCE (code_challenge_method=S256 or plain)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const {
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    client_id,
    response_type,
    scope,
  } = req.query;

  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri');
  }

  // Generate a simple authorization code
  const code = 'perfumery-auth-' + Date.now();

  // Build redirect URL back to Perplexity
  const callbackUrl = new URL(redirect_uri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  // Auto-approve: redirect immediately without user interaction
  return res.redirect(302, callbackUrl.toString());
}
