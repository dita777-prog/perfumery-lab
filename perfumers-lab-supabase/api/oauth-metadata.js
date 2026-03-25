// OAuth Authorization Server Metadata
// RFC 8414 - used by Perplexity MCP client discovery

const BASE = 'https://perfumery-lab.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    issuer: BASE,
    authorization_endpoint: BASE + '/api/authorize',
    token_endpoint: BASE + '/api/token',
    registration_endpoint: BASE + '/api/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256', 'plain'],
    scopes_supported: ['mcp'],
  });
}
