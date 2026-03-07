import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import {
  IdParam,
  PaginationQuery,
  ErrorResponse,
  CurrencyResponse,
  CreateCurrencyBody,
  UpdateCurrencyBody,
  CurrencyListResponse,
  CountryResponse,
  CreateCountryBody,
  UpdateCountryBody,
  CountryListResponse,
  WarehouseResponse,
  CreateWarehouseBody,
  UpdateWarehouseBody,
  WarehouseListResponse,
  ShippingRateResponse,
  CreateShippingRateBody,
  UpdateShippingRateBody,
  ShippingRateListResponse,
  RegionResponse,
  CreateRegionBody,
  UpdateRegionBody,
  RegionListResponse,
  OkResponse,
  DeletedResponse,
  RegionCountryAssociationBody,
  RegionWarehouseAssociationBody,
  RegionShippingRateAssociationBody,
  ShippingRatePriceBody,
} from '../schemas';
import { ApiError, uuid, now, type HonoEnv } from '../types';
import { getDb } from '../db';
import { adminOnly, authMiddleware } from '../middleware/auth';

const app = new OpenAPIHono<HonoEnv>();

app.use('*', authMiddleware);

// ============================================================
// CURRENCIES ROUTES
// ============================================================

const listCurrencies = createRoute({
  method: 'get',
  path: '/currencies',
  tags: ['Regions - Currencies'],
  summary: 'List all currencies',
  description: 'Get a paginated list of currencies',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { query: PaginationQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: CurrencyListResponse } },
      description: 'List of currencies',
    },
  },
});

app.openapi(listCurrencies, async (c) => {
  const { limit: limitStr, cursor } = c.req.valid('query');
  const db = getDb(c.var.db);
  const limit = Math.min(parseInt(limitStr || '100'), 500);

  let query = 'SELECT * FROM currencies WHERE 1=1';
  const params: unknown[] = [];

  if (cursor) {
    query += ' AND id > ?';
    params.push(cursor);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit + 1);

  const items = await db.query<any>(query, params);
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return c.json({
    items: items.map((item) => ({
      id: item.id,
      code: item.code,
      display_name: item.display_name,
      symbol: item.symbol,
      decimal_places: item.decimal_places,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: {
      has_more: hasMore,
      next_cursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    },
  }, 200);
});

const createCurrency = createRoute({
  method: 'post',
  path: '/currencies',
  tags: ['Regions - Currencies'],
  summary: 'Create a new currency',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { body: { content: { 'application/json': { schema: CreateCurrencyBody } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: CurrencyResponse } },
      description: 'Created currency',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invalid request',
    },
  },
});

app.openapi(createCurrency, async (c) => {
  const { code, display_name, symbol, decimal_places } = c.req.valid('json');
  const db = getDb(c.var.db);

  const id = uuid();
  const timestamp = now();

  await db.run(
    `INSERT INTO currencies (id, code, display_name, symbol, decimal_places, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, code, display_name, symbol, decimal_places, timestamp, timestamp]
  );

  const [currency] = await db.query<any>('SELECT * FROM currencies WHERE id = ?', [id]);

  return c.json({
    id: currency.id,
    code: currency.code,
    display_name: currency.display_name,
    symbol: currency.symbol,
    decimal_places: currency.decimal_places,
    status: currency.status,
    created_at: currency.created_at,
    updated_at: currency.updated_at,
  }, 201);
});

const getCurrency = createRoute({
  method: 'get',
  path: '/currencies/{id}',
  tags: ['Regions - Currencies'],
  summary: 'Get a currency',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: CurrencyResponse } },
      description: 'Currency details',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Currency not found',
    },
  },
});

app.openapi(getCurrency, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [currency] = await db.query<any>('SELECT * FROM currencies WHERE id = ?', [id]);
  if (!currency) throw ApiError.notFound('Currency not found');

  return c.json({
    id: currency.id,
    code: currency.code,
    display_name: currency.display_name,
    symbol: currency.symbol,
    decimal_places: currency.decimal_places,
    status: currency.status,
    created_at: currency.created_at,
    updated_at: currency.updated_at,
  }, 200);
});

const updateCurrency = createRoute({
  method: 'patch',
  path: '/currencies/{id}',
  tags: ['Regions - Currencies'],
  summary: 'Update a currency',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: UpdateCurrencyBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CurrencyResponse } },
      description: 'Updated currency',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Currency not found',
    },
  },
});

app.openapi(updateCurrency, async (c) => {
  const { id } = c.req.valid('param');
  const { display_name, symbol, decimal_places, status } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM currencies WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Currency not found');

  const updates: Record<string, unknown> = { updated_at: now() };
  if (display_name) updates.display_name = display_name;
  if (symbol) updates.symbol = symbol;
  if (decimal_places !== undefined) updates.decimal_places = decimal_places;
  if (status) updates.status = status;

  const setClauses = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
  const values = Object.values(updates);

  await db.run(`UPDATE currencies SET ${setClauses} WHERE id = ?`, [...values, id]);

  const [updated] = await db.query<any>('SELECT * FROM currencies WHERE id = ?', [id]);

  return c.json({
    id: updated.id,
    code: updated.code,
    display_name: updated.display_name,
    symbol: updated.symbol,
    decimal_places: updated.decimal_places,
    status: updated.status,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  }, 200);
});

const deleteCurrency = createRoute({
  method: 'delete',
  path: '/currencies/{id}',
  tags: ['Regions - Currencies'],
  summary: 'Delete a currency',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: DeletedResponse } },
      description: 'Currency deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Currency not found',
    },
  },
});

app.openapi(deleteCurrency, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM currencies WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Currency not found');

  await db.run('DELETE FROM currencies WHERE id = ?', [id]);

  return c.json({ deleted: true }, 200);
});

// ============================================================
// COUNTRIES ROUTES
// ============================================================

const listCountries = createRoute({
  method: 'get',
  path: '/countries',
  tags: ['Regions - Countries'],
  summary: 'List all countries',
  description: 'Get a paginated list of countries',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { query: PaginationQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: CountryListResponse } },
      description: 'List of countries',
    },
  },
});

app.openapi(listCountries, async (c) => {
  const { limit: limitStr, cursor } = c.req.valid('query');
  const db = getDb(c.var.db);
  const limit = Math.min(parseInt(limitStr || '100'), 500);

  let query = 'SELECT * FROM countries WHERE 1=1';
  const params: unknown[] = [];

  if (cursor) {
    query += ' AND id > ?';
    params.push(cursor);
  }

  query += ' ORDER BY country_name ASC LIMIT ?';
  params.push(limit + 1);

  const items = await db.query<any>(query, params);
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return c.json({
    items: items.map((item) => ({
      id: item.id,
      code: item.code,
      display_name: item.display_name,
      country_name: item.country_name,
      language_code: item.language_code,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: {
      has_more: hasMore,
      next_cursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    },
  }, 200);
});

const createCountry = createRoute({
  method: 'post',
  path: '/countries',
  tags: ['Regions - Countries'],
  summary: 'Create a new country',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { body: { content: { 'application/json': { schema: CreateCountryBody } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: CountryResponse } },
      description: 'Created country',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invalid request',
    },
  },
});

app.openapi(createCountry, async (c) => {
  const { code, display_name, country_name, language_code } = c.req.valid('json');
  const db = getDb(c.var.db);

  const id = uuid();
  const timestamp = now();

  await db.run(
    `INSERT INTO countries (id, code, display_name, country_name, language_code, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, code, display_name, country_name, language_code, timestamp, timestamp]
  );

  const [country] = await db.query<any>('SELECT * FROM countries WHERE id = ?', [id]);

  return c.json({
    id: country.id,
    code: country.code,
    display_name: country.display_name,
    country_name: country.country_name,
    language_code: country.language_code,
    status: country.status,
    created_at: country.created_at,
    updated_at: country.updated_at,
  }, 201);
});

const getCountry = createRoute({
  method: 'get',
  path: '/countries/{id}',
  tags: ['Regions - Countries'],
  summary: 'Get a country',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: CountryResponse } },
      description: 'Country details',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Country not found',
    },
  },
});

app.openapi(getCountry, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [country] = await db.query<any>('SELECT * FROM countries WHERE id = ?', [id]);
  if (!country) throw ApiError.notFound('Country not found');

  return c.json({
    id: country.id,
    code: country.code,
    display_name: country.display_name,
    country_name: country.country_name,
    language_code: country.language_code,
    status: country.status,
    created_at: country.created_at,
    updated_at: country.updated_at,
  }, 200);
});

const updateCountry = createRoute({
  method: 'patch',
  path: '/countries/{id}',
  tags: ['Regions - Countries'],
  summary: 'Update a country',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: UpdateCountryBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CountryResponse } },
      description: 'Updated country',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Country not found',
    },
  },
});

app.openapi(updateCountry, async (c) => {
  const { id } = c.req.valid('param');
  const { display_name, country_name, language_code, status } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM countries WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Country not found');

  const updates: Record<string, unknown> = { updated_at: now() };
  if (display_name) updates.display_name = display_name;
  if (country_name) updates.country_name = country_name;
  if (language_code) updates.language_code = language_code;
  if (status) updates.status = status;

  const setClauses = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
  const values = Object.values(updates);

  await db.run(`UPDATE countries SET ${setClauses} WHERE id = ?`, [...values, id]);

  const [updated] = await db.query<any>('SELECT * FROM countries WHERE id = ?', [id]);

  return c.json({
    id: updated.id,
    code: updated.code,
    display_name: updated.display_name,
    country_name: updated.country_name,
    language_code: updated.language_code,
    status: updated.status,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  }, 200);
});

const deleteCountry = createRoute({
  method: 'delete',
  path: '/countries/{id}',
  tags: ['Regions - Countries'],
  summary: 'Delete a country',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: DeletedResponse } },
      description: 'Country deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Country not found',
    },
  },
});

app.openapi(deleteCountry, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM countries WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Country not found');

  await db.run('DELETE FROM countries WHERE id = ?', [id]);

  return c.json({ deleted: true }, 200);
});

// ============================================================
// WAREHOUSES ROUTES
// ============================================================

const listWarehouses = createRoute({
  method: 'get',
  path: '/warehouses',
  tags: ['Regions - Warehouses'],
  summary: 'List all warehouses',
  description: 'Get a paginated list of warehouses ordered by priority',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { query: PaginationQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: WarehouseListResponse } },
      description: 'List of warehouses',
    },
  },
});

app.openapi(listWarehouses, async (c) => {
  const { limit: limitStr, cursor } = c.req.valid('query');
  const db = getDb(c.var.db);
  const limit = Math.min(parseInt(limitStr || '100'), 500);

  let query = 'SELECT * FROM warehouses WHERE 1=1';
  const params: unknown[] = [];

  if (cursor) {
    query += ' AND id > ?';
    params.push(cursor);
  }

  query += ' ORDER BY priority ASC, display_name ASC LIMIT ?';
  params.push(limit + 1);

  const items = await db.query<any>(query, params);
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return c.json({
    items: items.map((item) => ({
      id: item.id,
      display_name: item.display_name,
      address_line1: item.address_line1,
      address_line2: item.address_line2,
      city: item.city,
      state: item.state,
      postal_code: item.postal_code,
      country_code: item.country_code,
      priority: item.priority,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: {
      has_more: hasMore,
      next_cursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    },
  }, 200);
});

const createWarehouse = createRoute({
  method: 'post',
  path: '/warehouses',
  tags: ['Regions - Warehouses'],
  summary: 'Create a new warehouse',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { body: { content: { 'application/json': { schema: CreateWarehouseBody } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: WarehouseResponse } },
      description: 'Created warehouse',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invalid request',
    },
  },
});

app.openapi(createWarehouse, async (c) => {
  const { display_name, address_line1, address_line2, city, state, postal_code, country_code, priority } = c.req.valid('json');
  const db = getDb(c.var.db);

  const id = uuid();
  const timestamp = now();

  await db.run(
    `INSERT INTO warehouses (id, display_name, address_line1, address_line2, city, state, postal_code, country_code, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, display_name, address_line1, address_line2, city, state, postal_code, country_code, priority, timestamp, timestamp]
  );

  const [warehouse] = await db.query<any>('SELECT * FROM warehouses WHERE id = ?', [id]);

  return c.json({
    id: warehouse.id,
    display_name: warehouse.display_name,
    address_line1: warehouse.address_line1,
    address_line2: warehouse.address_line2,
    city: warehouse.city,
    state: warehouse.state,
    postal_code: warehouse.postal_code,
    country_code: warehouse.country_code,
    priority: warehouse.priority,
    status: warehouse.status,
    created_at: warehouse.created_at,
    updated_at: warehouse.updated_at,
  }, 201);
});

const getWarehouse = createRoute({
  method: 'get',
  path: '/warehouses/{id}',
  tags: ['Regions - Warehouses'],
  summary: 'Get a warehouse',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: WarehouseResponse } },
      description: 'Warehouse details',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Warehouse not found',
    },
  },
});

app.openapi(getWarehouse, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [warehouse] = await db.query<any>('SELECT * FROM warehouses WHERE id = ?', [id]);
  if (!warehouse) throw ApiError.notFound('Warehouse not found');

  return c.json({
    id: warehouse.id,
    display_name: warehouse.display_name,
    address_line1: warehouse.address_line1,
    address_line2: warehouse.address_line2,
    city: warehouse.city,
    state: warehouse.state,
    postal_code: warehouse.postal_code,
    country_code: warehouse.country_code,
    priority: warehouse.priority,
    status: warehouse.status,
    created_at: warehouse.created_at,
    updated_at: warehouse.updated_at,
  }, 200);
});

const updateWarehouse = createRoute({
  method: 'patch',
  path: '/warehouses/{id}',
  tags: ['Regions - Warehouses'],
  summary: 'Update a warehouse',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: UpdateWarehouseBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: WarehouseResponse } },
      description: 'Updated warehouse',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Warehouse not found',
    },
  },
});

app.openapi(updateWarehouse, async (c) => {
  const { id } = c.req.valid('param');
  const { display_name, address_line1, address_line2, city, state, postal_code, country_code, priority, status } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM warehouses WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Warehouse not found');

  const updates: Record<string, unknown> = { updated_at: now() };
  if (display_name) updates.display_name = display_name;
  if (address_line1) updates.address_line1 = address_line1;
  if (address_line2 !== undefined) updates.address_line2 = address_line2;
  if (city) updates.city = city;
  if (state !== undefined) updates.state = state;
  if (postal_code) updates.postal_code = postal_code;
  if (country_code) updates.country_code = country_code;
  if (priority !== undefined) updates.priority = priority;
  if (status) updates.status = status;

  const setClauses = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
  const values = Object.values(updates);

  await db.run(`UPDATE warehouses SET ${setClauses} WHERE id = ?`, [...values, id]);

  const [updated] = await db.query<any>('SELECT * FROM warehouses WHERE id = ?', [id]);

  return c.json({
    id: updated.id,
    display_name: updated.display_name,
    address_line1: updated.address_line1,
    address_line2: updated.address_line2,
    city: updated.city,
    state: updated.state,
    postal_code: updated.postal_code,
    country_code: updated.country_code,
    priority: updated.priority,
    status: updated.status,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  }, 200);
});

const deleteWarehouse = createRoute({
  method: 'delete',
  path: '/warehouses/{id}',
  tags: ['Regions - Warehouses'],
  summary: 'Delete a warehouse',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: DeletedResponse } },
      description: 'Warehouse deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Warehouse not found',
    },
  },
});

app.openapi(deleteWarehouse, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM warehouses WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Warehouse not found');

  await db.run('DELETE FROM warehouses WHERE id = ?', [id]);

  return c.json({ deleted: true }, 200);
});

// ============================================================
// SHIPPING RATES ROUTES
// ============================================================

const listShippingRates = createRoute({
  method: 'get',
  path: '/shipping-rates',
  tags: ['Regions - Shipping Rates'],
  summary: 'List all shipping rates',
  description: 'Get a paginated list of shipping rates',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { query: PaginationQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: ShippingRateListResponse } },
      description: 'List of shipping rates',
    },
  },
});

app.openapi(listShippingRates, async (c) => {
  const { limit: limitStr, cursor } = c.req.valid('query');
  const db = getDb(c.var.db);
  const limit = Math.min(parseInt(limitStr || '100'), 500);

  let query = 'SELECT * FROM shipping_rates WHERE 1=1';
  const params: unknown[] = [];

  if (cursor) {
    query += ' AND id > ?';
    params.push(cursor);
  }

  query += ' ORDER BY display_name ASC LIMIT ?';
  params.push(limit + 1);

  const items = await db.query<any>(query, params);
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return c.json({
    items: items.map((item) => ({
      id: item.id,
      display_name: item.display_name,
      description: item.description,
      max_weight_g: item.max_weight_g,
      min_delivery_days: item.min_delivery_days,
      max_delivery_days: item.max_delivery_days,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: {
      has_more: hasMore,
      next_cursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    },
  }, 200);
});

const createShippingRate = createRoute({
  method: 'post',
  path: '/shipping-rates',
  tags: ['Regions - Shipping Rates'],
  summary: 'Create a new shipping rate',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { body: { content: { 'application/json': { schema: CreateShippingRateBody } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: ShippingRateResponse } },
      description: 'Created shipping rate',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invalid request',
    },
  },
});

app.openapi(createShippingRate, async (c) => {
  const { display_name, description, max_weight_g, min_delivery_days, max_delivery_days } = c.req.valid('json');
  const db = getDb(c.var.db);

  const id = uuid();
  const timestamp = now();

  await db.run(
    `INSERT INTO shipping_rates (id, display_name, description, max_weight_g, min_delivery_days, max_delivery_days, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, display_name, description, max_weight_g, min_delivery_days, max_delivery_days, timestamp, timestamp]
  );

  const [rate] = await db.query<any>('SELECT * FROM shipping_rates WHERE id = ?', [id]);

  return c.json({
    id: rate.id,
    display_name: rate.display_name,
    description: rate.description,
    max_weight_g: rate.max_weight_g,
    min_delivery_days: rate.min_delivery_days,
    max_delivery_days: rate.max_delivery_days,
    status: rate.status,
    created_at: rate.created_at,
    updated_at: rate.updated_at,
  }, 201);
});

const getShippingRate = createRoute({
  method: 'get',
  path: '/shipping-rates/{id}',
  tags: ['Regions - Shipping Rates'],
  summary: 'Get a shipping rate',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: ShippingRateResponse } },
      description: 'Shipping rate details',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Shipping rate not found',
    },
  },
});

app.openapi(getShippingRate, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [rate] = await db.query<any>('SELECT * FROM shipping_rates WHERE id = ?', [id]);
  if (!rate) throw ApiError.notFound('Shipping rate not found');

  return c.json({
    id: rate.id,
    display_name: rate.display_name,
    description: rate.description,
    max_weight_g: rate.max_weight_g,
    min_delivery_days: rate.min_delivery_days,
    max_delivery_days: rate.max_delivery_days,
    status: rate.status,
    created_at: rate.created_at,
    updated_at: rate.updated_at,
  }, 200);
});

const updateShippingRate = createRoute({
  method: 'patch',
  path: '/shipping-rates/{id}',
  tags: ['Regions - Shipping Rates'],
  summary: 'Update a shipping rate',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: UpdateShippingRateBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ShippingRateResponse } },
      description: 'Updated shipping rate',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Shipping rate not found',
    },
  },
});

app.openapi(updateShippingRate, async (c) => {
  const { id } = c.req.valid('param');
  const { display_name, description, max_weight_g, min_delivery_days, max_delivery_days, status } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM shipping_rates WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Shipping rate not found');

  const updates: Record<string, unknown> = { updated_at: now() };
  if (display_name) updates.display_name = display_name;
  if (description !== undefined) updates.description = description;
  if (max_weight_g !== undefined) updates.max_weight_g = max_weight_g;
  if (min_delivery_days !== undefined) updates.min_delivery_days = min_delivery_days;
  if (max_delivery_days !== undefined) updates.max_delivery_days = max_delivery_days;
  if (status) updates.status = status;

  const setClauses = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
  const values = Object.values(updates);

  await db.run(`UPDATE shipping_rates SET ${setClauses} WHERE id = ?`, [...values, id]);

  const [updated] = await db.query<any>('SELECT * FROM shipping_rates WHERE id = ?', [id]);

  return c.json({
    id: updated.id,
    display_name: updated.display_name,
    description: updated.description,
    max_weight_g: updated.max_weight_g,
    min_delivery_days: updated.min_delivery_days,
    max_delivery_days: updated.max_delivery_days,
    status: updated.status,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  }, 200);
});

const deleteShippingRate = createRoute({
  method: 'delete',
  path: '/shipping-rates/{id}',
  tags: ['Regions - Shipping Rates'],
  summary: 'Delete a shipping rate',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: DeletedResponse } },
      description: 'Shipping rate deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Shipping rate not found',
    },
  },
});

app.openapi(deleteShippingRate, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM shipping_rates WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Shipping rate not found');

  await db.run('DELETE FROM shipping_rates WHERE id = ?', [id]);

  return c.json({ deleted: true }, 200);
});

// ============================================================
// REGIONS ROUTES
// ============================================================

const listRegions = createRoute({
  method: 'get',
  path: '/',
  tags: ['Regions'],
  summary: 'List all regions',
  description: 'Get a paginated list of regions',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { query: PaginationQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: RegionListResponse } },
      description: 'List of regions',
    },
  },
});

app.openapi(listRegions, async (c) => {
  const { limit: limitStr, cursor } = c.req.valid('query');
  const db = getDb(c.var.db);
  const limit = Math.min(parseInt(limitStr || '100'), 500);

  let query = `SELECT r.*, c.code as currency_code FROM regions r
               JOIN currencies c ON r.currency_id = c.id WHERE 1=1`;
  const params: unknown[] = [];

  if (cursor) {
    query += ' AND r.id > ?';
    params.push(cursor);
  }

  query += ' ORDER BY r.display_name ASC LIMIT ?';
  params.push(limit + 1);

  const items = await db.query<any>(query, params);
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return c.json({
    items: items.map((item) => ({
      id: item.id,
      display_name: item.display_name,
      currency_id: item.currency_id,
      currency_code: item.currency_code,
      is_default: item.is_default,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    pagination: {
      has_more: hasMore,
      next_cursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    },
  }, 200);
});

const createRegion = createRoute({
  method: 'post',
  path: '/',
  tags: ['Regions'],
  summary: 'Create a new region',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { body: { content: { 'application/json': { schema: CreateRegionBody } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: RegionResponse } },
      description: 'Created region',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Invalid request',
    },
  },
});

app.openapi(createRegion, async (c) => {
  const { display_name, currency_id, is_default, country_ids, warehouse_ids, shipping_rate_ids } = c.req.valid('json');
  const db = getDb(c.var.db);

  // Verify currency exists
  const [currency] = await db.query<any>('SELECT * FROM currencies WHERE id = ?', [currency_id]);
  if (!currency) throw ApiError.notFound('Currency not found');

  const id = uuid();
  const timestamp = now();

  // If this is default, unset other defaults
  if (is_default) {
    await db.run('UPDATE regions SET is_default = 0 WHERE is_default = 1');
  }

  await db.run(
    `INSERT INTO regions (id, display_name, currency_id, is_default, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    [id, display_name, currency_id, is_default ? 1 : 0, timestamp, timestamp]
  );

  // Add countries if provided
  if (country_ids && country_ids.length > 0) {
    for (const countryId of country_ids) {
      await db.run(
        'INSERT INTO region_countries (region_id, country_id) VALUES (?, ?)',
        [id, countryId]
      );
    }
  }

  // Add warehouses if provided
  if (warehouse_ids && warehouse_ids.length > 0) {
    for (const warehouseId of warehouse_ids) {
      await db.run(
        'INSERT INTO region_warehouses (region_id, warehouse_id) VALUES (?, ?)',
        [id, warehouseId]
      );
    }
  }

  // Add shipping rates if provided
  if (shipping_rate_ids && shipping_rate_ids.length > 0) {
    for (const shippingRateId of shipping_rate_ids) {
      await db.run(
        'INSERT INTO region_shipping_rates (region_id, shipping_rate_id) VALUES (?, ?)',
        [id, shippingRateId]
      );
    }
  }

  const [region] = await db.query<any>(
    `SELECT r.*, c.code as currency_code FROM regions r
     JOIN currencies c ON r.currency_id = c.id WHERE r.id = ?`,
    [id]
  );

  return c.json({
    id: region.id,
    display_name: region.display_name,
    currency_id: region.currency_id,
    currency_code: region.currency_code,
    is_default: region.is_default,
    status: region.status,
    created_at: region.created_at,
    updated_at: region.updated_at,
  }, 201);
});

const getRegion = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Regions'],
  summary: 'Get a region',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: RegionResponse } },
      description: 'Region details',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Region not found',
    },
  },
});

app.openapi(getRegion, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [region] = await db.query<any>(
    `SELECT r.*, c.code as currency_code FROM regions r
     JOIN currencies c ON r.currency_id = c.id WHERE r.id = ?`,
    [id]
  );
  if (!region) throw ApiError.notFound('Region not found');

  return c.json({
    id: region.id,
    display_name: region.display_name,
    currency_id: region.currency_id,
    currency_code: region.currency_code,
    is_default: region.is_default,
    status: region.status,
    created_at: region.created_at,
    updated_at: region.updated_at,
  }, 200);
});

const updateRegion = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Regions'],
  summary: 'Update a region',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: UpdateRegionBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RegionResponse } },
      description: 'Updated region',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Region not found',
    },
  },
});

app.openapi(updateRegion, async (c) => {
  const { id } = c.req.valid('param');
  const { display_name, currency_id, is_default, status } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM regions WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Region not found');

  // If setting as default, unset other defaults
  if (is_default) {
    await db.run('UPDATE regions SET is_default = 0 WHERE id != ?', [id]);
  }

  const updates: Record<string, unknown> = { updated_at: now() };
  if (display_name) updates.display_name = display_name;
  if (currency_id) updates.currency_id = currency_id;
  if (is_default !== undefined) updates.is_default = is_default ? 1 : 0;
  if (status) updates.status = status;

  const setClauses = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
  const values = Object.values(updates);

  await db.run(`UPDATE regions SET ${setClauses} WHERE id = ?`, [...values, id]);

  const [updated] = await db.query<any>(
    `SELECT r.*, c.code as currency_code FROM regions r
     JOIN currencies c ON r.currency_id = c.id WHERE r.id = ?`,
    [id]
  );

  return c.json({
    id: updated.id,
    display_name: updated.display_name,
    currency_id: updated.currency_id,
    currency_code: updated.currency_code,
    is_default: updated.is_default,
    status: updated.status,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  }, 200);
});

const deleteRegion = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Regions'],
  summary: 'Delete a region',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: { params: IdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: DeletedResponse } },
      description: 'Region deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Region not found',
    },
  },
});

app.openapi(deleteRegion, async (c) => {
  const { id } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [existing] = await db.query<any>('SELECT * FROM regions WHERE id = ?', [id]);
  if (!existing) throw ApiError.notFound('Region not found');

  await db.run('DELETE FROM regions WHERE id = ?', [id]);

  return c.json({ deleted: true }, 200);
});

// ============================================================
// REGION ASSOCIATIONS - Countries
// ============================================================

const addCountryToRegion = createRoute({
  method: 'post',
  path: '/{id}/countries',
  tags: ['Regions - Associations'],
  summary: 'Add a country to a region',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: RegionCountryAssociationBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OkResponse } },
      description: 'Country added to region',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Region or country not found',
    },
  },
});

app.openapi(addCountryToRegion, async (c) => {
  const { id } = c.req.valid('param');
  const { country_id } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [region] = await db.query<any>('SELECT * FROM regions WHERE id = ?', [id]);
  if (!region) throw ApiError.notFound('Region not found');

  const [country] = await db.query<any>('SELECT * FROM countries WHERE id = ?', [country_id]);
  if (!country) throw ApiError.notFound('Country not found');

  await db.run(
    'INSERT OR IGNORE INTO region_countries (region_id, country_id) VALUES (?, ?)',
    [id, country_id]
  );

  return c.json({ ok: true as const }, 200);
});

// ============================================================
// REGION ASSOCIATIONS - Warehouses
// ============================================================


const addWarehouseToRegion = createRoute({
  method: 'post',
  path: '/{id}/warehouses',
  tags: ['Regions - Associations'],
  summary: 'Add a warehouse to a region',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: RegionWarehouseAssociationBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OkResponse } },
      description: 'Warehouse added to region',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Region or warehouse not found',
    },
  },
});

app.openapi(addWarehouseToRegion, async (c) => {
  const { id } = c.req.valid('param');
  const { warehouse_id } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [region] = await db.query<any>('SELECT * FROM regions WHERE id = ?', [id]);
  if (!region) throw ApiError.notFound('Region not found');

  const [warehouse] = await db.query<any>('SELECT * FROM warehouses WHERE id = ?', [warehouse_id]);
  if (!warehouse) throw ApiError.notFound('Warehouse not found');

  await db.run(
    'INSERT OR IGNORE INTO region_warehouses (region_id, warehouse_id) VALUES (?, ?)',
    [id, warehouse_id]
  );

  return c.json({ ok: true as const }, 200);
});

// ============================================================
// REGION ASSOCIATIONS - Shipping Rates
// ============================================================


const addShippingRateToRegion = createRoute({
  method: 'post',
  path: '/{id}/shipping-rates',
  tags: ['Regions - Associations'],
  summary: 'Add a shipping rate to a region',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: RegionShippingRateAssociationBody } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OkResponse } },
      description: 'Shipping rate added to region',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Region or shipping rate not found',
    },
  },
});

app.openapi(addShippingRateToRegion, async (c) => {
  const { id } = c.req.valid('param');
  const { shipping_rate_id } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [region] = await db.query<any>('SELECT * FROM regions WHERE id = ?', [id]);
  if (!region) throw ApiError.notFound('Region not found');

  const [rate] = await db.query<any>('SELECT * FROM shipping_rates WHERE id = ?', [shipping_rate_id]);
  if (!rate) throw ApiError.notFound('Shipping rate not found');

  await db.run(
    'INSERT OR IGNORE INTO region_shipping_rates (region_id, shipping_rate_id) VALUES (?, ?)',
    [id, shipping_rate_id]
  );

  return c.json({ ok: true as const }, 200);
});

// ============================================================
// SHIPPING RATE PRICES
// ============================================================


const addShippingRatePrice = createRoute({
  method: 'post',
  path: '/shipping-rates/{id}/prices',
  tags: ['Regions - Shipping Rates'],
  summary: 'Add a price to a shipping rate',
  security: [{ bearerAuth: [] }],
  middleware: [adminOnly] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: ShippingRatePriceBody } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: OkResponse } },
      description: 'Shipping rate price created',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Shipping rate or currency not found',
    },
  },
});

app.openapi(addShippingRatePrice, async (c) => {
  const { id } = c.req.valid('param');
  const { currency_id, amount_cents } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [rate] = await db.query<any>('SELECT * FROM shipping_rates WHERE id = ?', [id]);
  if (!rate) throw ApiError.notFound('Shipping rate not found');

  const [currency] = await db.query<any>('SELECT * FROM currencies WHERE id = ?', [currency_id]);
  if (!currency) throw ApiError.notFound('Currency not found');

  const priceId = uuid();
  await db.run(
    `INSERT INTO shipping_rate_prices (id, shipping_rate_id, currency_id, amount_cents, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [priceId, id, currency_id, amount_cents, now()]
  );

  return c.json({ ok: true as const }, 201);
});

export { app as regions };
