// apps/merchant/src/routes/ai.ts
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { authMiddleware, adminOnly, aiAccessOnly } from '../middleware/auth';
import { ApiError, type HonoEnv } from '../types';

const app = new OpenAPIHono<HonoEnv>();
app.use('*', authMiddleware);

// Response schema
const AiParamsResponse = z.object({
  apiKey: z.string(),
  model: z.string(),
  url: z.string(),
});

const aiParamsRoute = createRoute({
  method: 'get',
  path: '/parameters',
  tags: ['AI'],
  summary: 'Retrieve AI configuration for the client',
  description:
    'Returns the API key, model and base URL for the AI provider. ' +
    'Requires admin permission. ' +
    'Values are set via GitHub secrets at deploy time.',
  security: [{ bearerAuth: ['ai:api'] }],
  middleware: [aiAccessOnly] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: AiParamsResponse } },
      description: 'AI parameters',
    },
    503: {
      description: 'AI not configured on this instance',
    },
  },
});

app.openapi(aiParamsRoute, async (c) => {
  const apiKey = c.env.AI_API_KEY;
  const model = c.env.AI_MODEL;
  const url = c.env.AI_API_URL;

  // If any required value is missing, return 503 so the client can
  // hide the AI button gracefully instead of showing a cryptic error.
  if (!apiKey || !model || !url) {
    throw new ApiError(
      'not_configured',
      503,
      'AI is not configured. Set AI_API_KEY, AI_MODEL and AI_API_URL.'
    );
  }

  return c.json({ apiKey, model, url }, 200);
});

export { app as ai };
