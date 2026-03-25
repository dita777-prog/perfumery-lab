// OAuth Authorization endpoint
// Auto-approves access and redirects back to Perplexity with authorization code

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { redirect_uri, state, code_challenge, code_challenge_method } = req.query;

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
