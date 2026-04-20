// GET /api/assistant/openapi.json
// Static OpenAPI 3.0 schema for ChatGPT Custom Actions / Claude tool use.
export default function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    openapi: '3.0.1',
    info: {
      title: 'Perfumery Lab Assistant API',
      description: 'Narrow, token-gated read/write access to the Perfumery Lab Supabase database.',
      version: '1.0.0',
    },
    servers: [{ url: 'https://perfumery-lab.vercel.app' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
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
              ],
            },
            data: { type: 'object', additionalProperties: true },
          },
        },
        WriteResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            action: { type: 'string' },
            written: { type: 'object', additionalProperties: true },
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
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/assistant/read': {
        get: {
          operationId: 'readTable',
          summary: 'Read rows from a whitelisted table',
          parameters: [
            {
              name: 'table',
              in: 'query',
              required: true,
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
              description: 'Table name to read from (whitelist).',
            },
            {
              name: 'filter',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Simple equality filter in the form `field:value` (e.g. `status:active`).',
            },
          ],
          responses: {
            '200': {
              description: 'Array of rows',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { type: 'object', additionalProperties: true } },
                },
              },
            },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/assistant/write': {
        post: {
          operationId: 'writeAction',
          summary: 'Perform a whitelisted write action',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WriteRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Success',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/WriteResponse' } } },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            '401': { description: 'Unauthorized' },
          },
        },
      },
    },
  });
}
