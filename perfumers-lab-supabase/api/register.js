// OAuth Dynamic Client Registration endpoint for MCP
// Allows Perplexity to auto-register as MCP client

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Accept any client registration and return fake credentials
  const body = req.body || {};
  const clientId = 'perplexity-' + Date.now();

  return res.status(201).json({
    client_id: clientId,
    client_secret: 'no-secret-needed',
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
    redirect_uris: body.redirect_uris || [],
    grant_types: ['authorization_code', 'client_credentials'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic'
  });
}
