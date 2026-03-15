import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { getDb } from '../db';
import { authMiddleware, adminOnly, databaseAdminOnly } from '../middleware/auth';
import { ApiError, now, type HonoEnv } from '../types';
import { SetupStripeBody, OkResponse, ErrorResponse } from '../schemas';

const app = new OpenAPIHono<HonoEnv>();

const InitKeysBody = z.object({
  keys: z.array(z.object({
    id: z.string().uuid(),
    key_hash: z.string(),
    key_prefix: z.string(),
    role: z.enum(['public', 'admin']),
  })),
}).openapi('InitKeysBody');

const initKeys = createRoute({
  method: 'post',
  path: '/init',
  tags: ['Setup'],
  summary: 'Initialize API keys',
  description: 'Create initial API keys (only works if no keys exist)',
  request: {
    body: { content: { 'application/json': { schema: InitKeysBody } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: OkResponse } }, description: 'Keys created' },
    409: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Keys already exist' },
  },
});

app.openapi(initKeys, async (c) => {
  const { keys } = c.req.valid('json');
  const db = getDb(c.var.db);

  const existing = await db.query<{ id: string }>(`SELECT id FROM api_keys LIMIT 1`);
  if (existing.length > 0) {
    throw ApiError.conflict('API keys already exist. Use admin key to manage keys.');
  }

  for (const key of keys) {
    await db.run(
      `INSERT INTO api_keys (id, key_hash, key_prefix, role, created_at) VALUES (?, ?, ?, ?, ?)`,
      [key.id, key.key_hash, key.key_prefix, key.role, now()]
    );
  }

  return c.json({ ok: true as const }, 200);
});

const setupStripe = createRoute({
  method: 'post',
  path: '/stripe',
  tags: ['Setup'],
  summary: 'Connect Stripe',
  description: 'Configure Stripe API keys for payment processing',
  security: [{ bearerAuth: ["sk_","admin:store"] }],
  middleware: [authMiddleware, adminOnly] as const,
  request: {
    body: { content: { 'application/json': { schema: SetupStripeBody } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: OkResponse } }, description: 'Stripe connected' },
    400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid Stripe key' },
  },
});

app.openapi(setupStripe, async (c) => {
  const { stripe_secret_key, stripe_webhook_secret } = c.req.valid('json');

  const res = await fetch('https://api.stripe.com/v1/balance', {
    headers: { Authorization: `Bearer ${stripe_secret_key}` },
  });

  if (!res.ok) {
    throw ApiError.invalidRequest('Invalid Stripe secret key');
  }

  const db = getDb(c.var.db);

  const configValue = JSON.stringify({
    secret_key: stripe_secret_key,
    webhook_secret: stripe_webhook_secret || null,
  });

  await db.run(
    `INSERT INTO config (key, value, updated_at) VALUES ('stripe', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
    [configValue, now(), configValue, now()]
  );

  return c.json({ ok: true as const }, 200);
});

const resetDatabase = createRoute({
  method: 'post',
  path: '/reset',
  tags: ['Setup'],
  summary: 'Wipe and reset the database',
  description: 'Clears all data so init/seed can be rerun. Requires database admin role (JWT only).',
  security: [{ bearerAuth: ["admin:database"] }],
  middleware: [authMiddleware, databaseAdminOnly] as const,
  responses: {
    200: { content: { 'application/json': { schema: OkResponse } }, description: 'Database reset' },
  },
});

app.openapi(resetDatabase, async (c) => {
  const db = getDb(c.var.db);

  // Disable foreign key checks to allow deletion in any order
  await db.run('PRAGMA foreign_keys = OFF');

  const tables = [
    'order_items',
    'orders',
    'cart_items',
    'carts',
    'inventory_logs',
    'inventory',
    'variant_prices',
    'variants',
    'products',
    'warehouse_inventory_logs',
    'warehouse_inventory',
    'region_shipping_rates',
    'region_warehouses',
    'region_countries',
    'regions',
    'shipping_rate_prices',
    'shipping_rates',
    'warehouses',
    'countries',
    'currencies',
    'discount_usage',
    'discounts',
    'refunds',
    'customer_addresses',
    'customers',
    'events',
    'webhook_deliveries',
    'webhooks',
    'oauth_tokens',
    'oauth_authorizations',
    'oauth_clients',
    'config',
    'api_keys',
  ];

  for (const table of tables) {
    await db.run(`DELETE FROM ${table}`);
  }

  await db.run('PRAGMA foreign_keys = ON');

  return c.json({ ok: true as const }, 200);
});

export { app as setup };
