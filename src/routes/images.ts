import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { ApiError, uuid, type HonoEnv } from '../types';
import { ImageUploadResponse, ErrorResponse, OkResponse } from '../schemas';

const ImageKeyParam = z.object({
  key: z.string().openapi({ param: { name: 'key', in: 'path' }, example: 'abc123.jpg' }),
});

const app = new OpenAPIHono<HonoEnv>();

const uploadImage = createRoute({
  method: 'post',
  path: '/',
  tags: ['Images'],
  summary: 'Upload an image',
  security: [{ bearerAuth: ["sk_","admin:store"] }],
  middleware: [authMiddleware, adminOnly] as const,
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any().openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: ImageUploadResponse } }, description: 'Image uploaded' },
    400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid file' },
  },
});

app.openapi(uploadImage, async (c) => {
  if (!c.env.IMAGES) {
    throw ApiError.invalidRequest('R2 bucket not configured');
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) throw ApiError.invalidRequest('file is required');

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw ApiError.invalidRequest('File must be jpeg, png, webp, or gif');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw ApiError.invalidRequest('File must be under 5MB');
  }

  const ext = file.type.split('/')[1];
  const key = `${uuid()}.${ext}`;

  await c.env.IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const baseUrl = c.env.IMAGES_URL || `${new URL(c.req.url).origin}/v1/images`;
  const url = `${baseUrl}/${key}`;

  return c.json({ url, key }, 200);
});

const getImage = createRoute({
  method: 'get',
  path: '/{key}',
  tags: ['Images'],
  summary: 'Get an image',
  request: { params: ImageKeyParam },
  responses: {
    200: { description: 'Image binary' },
    404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Image not found' },
  },
});

app.openapi(getImage, async (c) => {
  const { key } = c.req.valid('param');

  if (!c.env.IMAGES) {
    throw ApiError.invalidRequest('R2 bucket not configured');
  }

  const object = await c.env.IMAGES.get(key);
  if (!object) {
    throw ApiError.notFound('Image not found');
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
});

const deleteImage = createRoute({
  method: 'delete',
  path: '/{key}',
  tags: ['Images'],
  summary: 'Delete an image',
  security: [{ bearerAuth: ["sk_","admin:store"] }],
  middleware: [authMiddleware, adminOnly] as const,
  request: { params: ImageKeyParam },
  responses: {
    200: { content: { 'application/json': { schema: OkResponse } }, description: 'Image deleted' },
    400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid request' },
  },
});

app.openapi(deleteImage, async (c) => {
  const { key } = c.req.valid('param');

  if (!c.env.IMAGES) {
    throw ApiError.invalidRequest('R2 bucket not configured');
  }

  if (!key) {
    throw ApiError.invalidRequest('Image key is required');
  }

  await c.env.IMAGES.delete(key);

  return c.json({ ok: true as const }, 200);
});

export { app as images };
