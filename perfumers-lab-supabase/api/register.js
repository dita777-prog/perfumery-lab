// OAuth Dynamic Client Registration endpoint (RFC 7591)
// Allows Perplexity to auto-register as MCP client

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  const clientId = 'perplexity-mcp-client';
  const now = Math.floor(Date.now() / 1000);

  // RFC 7591 compliant response
  return res.status(201).json({
    client_id: clientId,
    client_secret: 'mcp-open-access',
    client_id_issued_at: now,
    client_secret_expires_at: 0,
    redirect_uris: body.redirect_uris || ['https://www.perplexity.ai/callback'],
    client_name: body.client_name || 'Perplexity MCP',
    grant_types: body.grant_types || ['authorization_code', 'client_credentials'],
    response_types: ['code'],
    scope: 'mcp',
    token_endpoint_auth_method: 'client_secret_basic'
  });
}
