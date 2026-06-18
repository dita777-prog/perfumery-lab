export default function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  res.status(200).json({
    openapi: '3.0.1',
    info: {
      title: 'Perfumery Lab Assistant API',
      description:
        'Stable assistant API for Perfumery Lab. Auth is Authorization: Bearer <ASSISTANT_API_TOKEN> only.',
      version: '2.0.0',
    },
    servers: [{ url: 'https://perfumery-lab.vercel.app' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        AssistantError: {
          type: 'object',
          nullable: true,
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            hint: { type: 'string' },
          },
        },
        AssistantMeta: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            request_url: { type: 'string' },
            auth_mode: { type: 'string', enum: ['bearer', 'missing', 'query_apikey_not_allowed'] },
            status: { type: 'integer' },
            table: { type: 'string' },
            count: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            formula_id: { type: 'string' },
            ingredient_count: { type: 'integer' },
          },
        },
        AssistantEnvelope: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {},
            meta: { $ref: '#/components/schemas/AssistantMeta' },
            error: { $ref: '#/components/schemas/AssistantError' },
          },
        },
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
            },
            data: {
              type: 'object',
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/assistant/read': {
        get: {
          operationId: 'readTable',
          summary: 'Read normalized rows from a whitelisted table',
          description:
            'Returns a stable envelope with normalized assistant fields. Use Authorization: Bearer <ASSISTANT_API_TOKEN>.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'table',
              in: 'query',
              required: true,
              description: 'Table to read from',
              schema: {
                type: 'string',
                enum: [
                  'formulas',
                  'formula_ingredients',
                  'materials',
                  'material_sources',
                  'production_batches',
                  'stock_movements',
                  'formula_categories',
                ],
              },
            },
            {
              name: 'id',
              in: 'query',
              required: false,
              description: 'Exact row id',
              schema: { type: 'string' },
            },
            {
              name: 'filter',
              in: 'query',
              required: false,
              description: 'One or more equality filters in field:value format, separated by commas',
              schema: { type: 'string' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Search value',
              schema: { type: 'string' },
            },
            {
              name: 'search_field',
              in: 'query',
              required: false,
              description: 'Column to search in (defaults to name)',
              schema: { type: 'string' },
            },
            {
              name: 'exact',
              in: 'query',
              required: false,
              description: 'Exact match instead of ILIKE',
              schema: { type: 'string', enum: ['true', 'false'] },
            },
            {
              name: 'order',
              in: 'query',
              required: false,
              description: 'Column to sort by',
              schema: { type: 'string' },
            },
            {
              name: 'ascending',
              in: 'query',
              required: false,
              description: 'Sort direction: true = ASC, false = DESC',
              schema: { type: 'string', enum: ['true', 'false'] },
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Max rows to return',
              schema: { type: 'integer', default: 50, maximum: 200 },
            },
            {
              name: 'offset',
              in: 'query',
              required: false,
              description: 'Row offset',
              schema: { type: 'integer', default: 0 },
            },
          ],
          responses: {
            '200': {
              description: 'Rows returned successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AssistantEnvelope' },
                },
              },
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' },
            '405': { description: 'Method not allowed' },
            '500': { description: 'Server error' },
            '503': { description: 'Token not configured' },
          },
        },
      },
      '/api/assistant/formula-detail': {
        get: {
          operationId: 'getFormulaDetail',
          summary: 'Get one formula with category and ingredients',
          description:
            'Returns a stable envelope containing one formula and its ingredients. Use id for the most reliable lookup, or name with optional category/category_id.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'query', required: false, description: 'Formula UUID', schema: { type: 'string' } },
            { name: 'name', in: 'query', required: false, description: 'Exact formula name', schema: { type: 'string' } },
            { name: 'category', in: 'query', required: false, description: 'Category name, e.g. PRODUCTION', schema: { type: 'string' } },
            { name: 'category_id', in: 'query', required: false, description: 'Category UUID', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Formula detail returned successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AssistantEnvelope' },
                },
              },
            },
            '400': { description: 'Missing id or name' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Formula not found' },
            '409': { description: 'Multiple formulas matched' },
            '500': { description: 'Server error' },
            '503': { description: 'Token not configured' },
          },
        },
      },
      '/api/assistant/write': {
        post: {
          operationId: 'writeAction',
          summary: 'Perform a whitelisted write action',
          description:
            'IMPORTANT: This endpoint requires HTTP POST with Content-Type: application/json and Authorization: Bearer <ASSISTANT_API_TOKEN>.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WriteRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Action performed successfully' },
            '400': { description: 'Validation error' },
            '401': { description: 'Unauthorized' },
            '405': { description: 'Method not allowed' },
          },
        },
      },
    },
  });
}
