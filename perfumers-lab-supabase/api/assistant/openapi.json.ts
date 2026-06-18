// GET /api/assistant/openapi.json
// Static OpenAPI 3.0 schema for ChatGPT Custom Actions / Claude tool use.
export default function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    openapi: '3.0.1',
    info: {
      title: 'Perfumery Lab Assistant API',
      description: 'Read/write access to the Perfumery Lab Supabase database. Auth via Bearer token OR ?apikey= query param.',
      version: '1.2.0',
    },
    servers: [{ url: 'https://perfumery-lab.vercel.app' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        apiKeyQuery: { type: 'apiKey', in: 'query', name: 'apikey' },
      },
      schemas: {
        WriteRequest: {
          type: 'object',
          required: ['action', 'data'],
          properties: {
            action: {
              type: 'string',
              enum: [
                'create_stock_movement',
                'create_production_batch',
                'update_formula_notes',
                'update_formula_status',
                'create_formula',
                'create_formula_ingredient',
              ],
              description: 'Action to perform. Use create_formula to create a new formula, then create_formula_ingredient for each ingredient.',
            },
            data: {
              type: 'object',
              description: 'Payload for the action. Fields depend on action: create_formula requires name+category; create_formula_ingredient requires formula_id+material_id+grams.',
            },
          },
        },
        WriteResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            action: { type: 'string' },
            written: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            missing: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { apiKeyQuery: [] }],
    paths: {
      '/api/assistant/read': {
        get: {
          operationId: 'readTable',
          summary: 'Read rows from a whitelisted table',
          description: 'Returns paginated rows. Auth via Authorization: Bearer header OR ?apikey= query param.',
          security: [{ bearerAuth: [] }, { apiKeyQuery: [] }],
          parameters: [
            {
              name: 'table',
              in: 'query',
              required: true,
              description: 'Table to read from',
              schema: {
                type: 'string',
                enum: ['formulas', 'formula_ingredients', 'materials', 'material_sources', 'production_batches', 'stock_movements', 'formula_categories'],
              },
            },
            { name: 'apikey', in: 'query', required: false, description: 'API token (alternative to Bearer header)', schema: { type: 'string' } },
            { name: 'filter', in: 'query', required: false, description: 'Equality filter in the form field:value (e.g. status:active)', schema: { type: 'string' } },
            { name: 'search', in: 'query', required: false, description: 'Full-text search term (case-insensitive ILIKE)', schema: { type: 'string' } },
            { name: 'search_field', in: 'query', required: false, description: 'Column to search in (defaults to name)', schema: { type: 'string' } },
            { name: 'order', in: 'query', required: false, description: 'Column to sort by', schema: { type: 'string' } },
            { name: 'ascending', in: 'query', required: false, description: 'Sort direction: true = ASC (default), false = DESC', schema: { type: 'string', enum: ['true', 'false'] } },
            { name: 'limit', in: 'query', required: false, description: 'Max rows to return (default 50, max 200)', schema: { type: 'integer', default: 50, maximum: 200 } },
            { name: 'offset', in: 'query', required: false, description: 'Row offset for pagination (default 0)', schema: { type: 'integer', default: 0 } },
          ],
          responses: {
            '200': {
              description: 'Rows returned successfully',
              content: { 'application/json': { schema: { type: 'object', properties: { table: { type: 'string' }, count: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' }, data: { type: 'array', items: { type: 'object' } } } } } },
            },
            '401': { description: 'Unauthorized - missing or invalid token' },
            '400': { description: 'Invalid table name' },
          },
        },
      },
            '/api/assistant/formula-detail': {
        get: {
          operationId: 'getFormulaDetail',
          summary: 'Get one formula with category and ingredients',
          description: 'Returns a single formula including its category and ingredient rows with material details. Use id for the most reliable lookup, or name with optional category/category_id.',
          security: [{ bearerAuth: [] }, { apiKeyQuery: [] }],
          parameters: [
            { name: 'id', in: 'query', required: false, description: 'Formula UUID', schema: { type: 'string' } },
            { name: 'name', in: 'query', required: false, description: 'Exact formula name', schema: { type: 'string' } },
            { name: 'category', in: 'query', required: false, description: 'Category name, e.g. PRODUCTION', schema: { type: 'string' } },
            { name: 'category_id', in: 'query', required: false, description: 'Category UUID', schema: { type: 'string' } },
            { name: 'apikey', in: 'query', required: false, description: 'API token (alternative to Bearer header)', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Formula detail returned successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      formula: { type: 'object' },
                      ingredients: { type: 'array', items: { type: 'object' } },
                      ingredient_count: { type: 'integer' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Missing id or name' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Formula not found' },
            '409': { description: 'Multiple formulas matched; narrow the query' },
          },
        },
      },
      '/api/assistant/write': {
        post: {
          operationId: 'writeAction',
          summary: 'Perform a whitelisted write action',
          description: 'IMPORTANT: This endpoint requires HTTP POST with Content-Type: application/json. Do NOT use GET. Send action and data fields in the JSON body.',
          security: [{ bearerAuth: [] }, { apiKeyQuery: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/WriteRequest' },
                examples: {
                  create_formula: {
                    summary: 'Create a new formula',
                    value: { action: 'create_formula', data: { name: 'My Formula', category: 'PRODUCTION', status: 'active' } },
                  },
                  create_formula_ingredient: {
                    summary: 'Add ingredient to formula',
                    value: { action: 'create_formula_ingredient', data: { formula_id: 'uuid-here', material_id: 'uuid-here', grams: 10.5 } },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Action performed successfully',
              content: { 'application/json': { schema: { '$ref': '#/components/schemas/WriteResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } },
            },
            '401': { description: 'Unauthorized' },
            '405': { description: 'Method not allowed - must use POST' },
          },
        },
      },
    },
  });
}
