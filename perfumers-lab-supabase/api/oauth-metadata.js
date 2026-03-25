// OAuth Authorization Server Metadata
// RFC 8414 - used by Perplexity MCP client discovery

const BASE = 'https://perfumery-lab.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    issuer: BASE,
    authorization_endpoint: BASE + '/api/authorize',
    token_endpoint: BASE + '/api/token',
    registration_endpoint: BASE + '/api/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
    scopes_supported: ['mcp']
  });
}
