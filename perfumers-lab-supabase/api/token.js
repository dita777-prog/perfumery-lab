// OAuth Token endpoint - issues access tokens for MCP
// Since our MCP has no real auth, we issue a simple static token

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Issue a static access token - no real auth needed
  return res.status(200).json({
    access_token: 'perfumery-lab-access-token',
    token_type: 'bearer',
    expires_in: 86400,
    scope: 'mcp'
  });
}
