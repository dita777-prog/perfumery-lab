// OAuth Dynamic Client Registration endpoint (RFC 7591)
// Allows Perplexity to auto-register as MCP client

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Only POST is valid for registration
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = req.body || {};
  const now = Math.floor(Date.now() / 1000);

  // Generate a unique client_id per registration
  const clientId = 'perplexity-mcp-' + now;

  // RFC 7591 compliant response
  // client_secret_expires_at must NOT be 0 — use null/omit or a future timestamp
  // Perplexity rejects 0 as invalid
  const response = {
    client_id: clientId,
    client_secret: 'mcp-open-access',
    client_id_issued_at: now,
    redirect_uris: body.redirect_uris || ['https://www.perplexity.ai/callback'],
    client_name: body.client_name || 'Perplexity MCP',
    grant_types: body.grant_types || ['authorization_code'],
    response_types: ['code'],
    scope: body.scope || 'mcp',
    token_endpoint_auth_method: 'none',
  };

  return res.status(201).json(response);
}
