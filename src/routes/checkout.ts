import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import Stripe from 'stripe';
import { getDb } from '../db';
import { authMiddleware } from '../middleware/auth';
import { ApiError, uuid, now, isValidEmail, type HonoEnv } from '../types';
import { validateDiscount, calculateDiscount, type Discount } from './discounts';
import {
  CartIdParam,
  CartResponse,
  CreateCartBody,
  AddCartItemsBody,
  CheckoutBody,
  CheckoutResponse,
  ApplyDiscountBody,
  ApplyDiscountResponse,
  ErrorResponse,
  CartTotals,
} from '../schemas';

const RemoveDiscountResponse = z.object({
  discount: z.null(),
  totals: CartTotals,
}).openapi('RemoveDiscountResponse');

const app = new OpenAPIHono<HonoEnv>();

app.use('*', authMiddleware);

const getCart = createRoute({
  method: 'get',
  path: '/{cartId}',
  tags: ['Checkout'],
  summary: 'Get cart by ID',
  request: { params: CartIdParam },
  responses: {
    200: { content: { 'application/json': { schema: CartResponse } }, description: 'Cart details' },
    404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart not found' },
  },
});

app.openapi(getCart, async (c) => {
  const { cartId } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [cart] = await db.query<any>(`SELECT * FROM carts WHERE id = ?`, [cartId]);
  if (!cart) throw ApiError.notFound('Cart not found');

  const items = await db.query<any>(`SELECT * FROM cart_items WHERE cart_id = ?`, [cartId]);

  // Get shipping info
  let shippingInfo = { rate_id: null as string | null, rate_name: null as string | null, amount_cents: 0 };
  if (cart.shipping_rate_id) {
    const [rate] = await db.query<any>(`SELECT * FROM shipping_rates WHERE id = ?`, [cart.shipping_rate_id]);
    if (rate) {
      shippingInfo.rate_id = rate.id;
      shippingInfo.rate_name = rate.display_name;
      shippingInfo.amount_cents = cart.shipping_cents || 0;
    }
  }

  return c.json({
    id: cart.id,
    status: cart.status,
    currency: cart.currency,
    region_id: cart.region_id,
    customer_email: cart.customer_email,
    items: items.map((i) => ({
      sku: i.sku,
      title: i.title,
      qty: i.qty,
      unit_price_cents: i.unit_price_cents,
    })),
    shipping: shippingInfo,
    expires_at: cart.expires_at,
    stripe_checkout_session_id: cart.stripe_checkout_session_id,
  }, 200);
});

const createCart = createRoute({
  method: 'post',
  path: '/',
  tags: ['Checkout'],
  summary: 'Create a new cart',
  request: { body: { content: { 'application/json': { schema: CreateCartBody } } } },
  responses: {
    200: { content: { 'application/json': { schema: CartResponse } }, description: 'Created cart' },
    400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid email' },
  },
});

app.openapi(createCart, async (c) => {
  const { customer_email, region_id } = c.req.valid('json');

  if (!isValidEmail(customer_email)) {
    throw ApiError.invalidRequest('A valid customer_email is required');
  }

  const db = getDb(c.var.db);
  const id = uuid();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  let currency = 'USD';
  let resolvedRegionId = region_id || null;

  // If region_id provided, validate and get currency
  if (region_id) {
    const [region] = await db.query<any>(
      `SELECT r.*, c.code as currency_code FROM regions r
       JOIN currencies c ON r.currency_id = c.id
       WHERE r.id = ? AND r.status = 'active'`,
      [region_id]
    );
    if (!region) throw ApiError.notFound('Region not found or inactive');
    currency = region.currency_code;
  } else {
    // Try to get default region
    const [defaultRegion] = await db.query<any>(
      `SELECT r.*, c.code as currency_code FROM regions r
       JOIN currencies c ON r.currency_id = c.id
       WHERE r.is_default = 1 AND r.status = 'active'`
    );
    if (defaultRegion) {
      resolvedRegionId = defaultRegion.id;
      currency = defaultRegion.currency_code;
    }
  }

  await db.run(
    `INSERT INTO carts (id, customer_email, currency, region_id, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [id, customer_email, currency, resolvedRegionId, expiresAt]
  );

  return c.json({
    id,
    status: 'open' as const,
    currency,
    region_id: resolvedRegionId,
    customer_email,
    items: [],
    discount: null,
    shipping: {
      rate_id: null,
      rate_name: null,
      amount_cents: 0,
    },
    totals: {
      subtotal_cents: 0,
      discount_cents: 0,
      shipping_cents: 0,
      tax_cents: 0,
      total_cents: 0,
    },
    expires_at: expiresAt,
  }, 200);
});

const addCartItems = createRoute({
  method: 'post',
  path: '/{cartId}/items',
  tags: ['Checkout'],
  summary: 'Add items to cart',
  description: 'Replaces existing cart items with the provided items',
  request: {
    params: CartIdParam,
    body: { content: { 'application/json': { schema: AddCartItemsBody } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: CartResponse } }, description: 'Updated cart' },
    400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid request' },
    404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart or SKU not found' },
    409: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart is not open' },
  },
});

app.openapi(addCartItems, async (c) => {
  const { cartId } = c.req.valid('param');
  const { items } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [cart] = await db.query<any>(`SELECT * FROM carts WHERE id = ?`, [cartId]);
  if (!cart) throw ApiError.notFound('Cart not found');
  if (cart.status !== 'open') throw ApiError.conflict('Cart is not open');

  const validatedItems = [];
  for (const { sku, qty } of items) {
    const [variant] = await db.query<any>(`SELECT * FROM variants WHERE sku = ?`, [sku]);
    if (!variant) throw ApiError.notFound(`SKU not found: ${sku}`);
    if (variant.status !== 'active') throw ApiError.invalidRequest(`SKU not active: ${sku}`);

    const [inv] = await db.query<any>(`SELECT * FROM inventory WHERE sku = ?`, [sku]);
    const available = (inv?.on_hand ?? 0) - (inv?.reserved ?? 0);
    if (available < qty) throw ApiError.insufficientInventory(sku);

    validatedItems.push({
      sku,
      title: variant.title,
      qty,
      unit_price_cents: variant.price_cents,
    });
  }

  await db.run(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);

  for (const item of validatedItems) {
    await db.run(
      `INSERT INTO cart_items (id, cart_id, sku, title, qty, unit_price_cents) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid(), cartId, item.sku, item.title, item.qty, item.unit_price_cents]
    );
  }

  const allCartItems = await db.query<any>(`SELECT * FROM cart_items WHERE cart_id = ?`, [cartId]);
  const subtotalCents = allCartItems.reduce(
    (sum, item) => sum + item.unit_price_cents * item.qty,
    0
  );

  let discountInfo = null;
  let discountAmountCents = 0;
  if (cart.discount_id) {
    const [discount] = await db.query<any>(`SELECT * FROM discounts WHERE id = ?`, [
      cart.discount_id,
    ]);
    if (discount) {
      try {
        await validateDiscount(db, discount as Discount, subtotalCents, cart.customer_email);
        discountAmountCents = calculateDiscount(discount as Discount, subtotalCents);
        await db.run(`UPDATE carts SET discount_amount_cents = ? WHERE id = ?`, [
          discountAmountCents,
          cartId,
        ]);
        discountInfo = {
          code: discount.code,
          type: discount.type as 'percentage' | 'fixed_amount',
          amount_cents: discountAmountCents,
        };
      } catch {
        await db.run(
          `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
          [cartId]
        );
      }
    } else {
      await db.run(
        `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
        [cartId]
      );
    }
  }

  return c.json({
    id: cart.id,
    status: cart.status,
    currency: cart.currency,
    customer_email: cart.customer_email,
    items: allCartItems.map((item) => ({
      sku: item.sku,
      title: item.title,
      qty: item.qty,
      unit_price_cents: item.unit_price_cents,
    })),
    discount: discountInfo,
    totals: {
      subtotal_cents: subtotalCents,
      discount_cents: discountAmountCents,
      shipping_cents: 0,
      tax_cents: 0,
      total_cents: subtotalCents - discountAmountCents,
    },
    expires_at: cart.expires_at,
  }, 200);
});

const checkoutCart = createRoute({
  method: 'post',
  path: '/{cartId}/checkout',
  tags: ['Checkout'],
  summary: 'Initiate Stripe checkout',
  description: 'Creates a Stripe checkout session and returns the URL',
  request: {
    params: CartIdParam,
    body: { content: { 'application/json': { schema: CheckoutBody } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: CheckoutResponse } }, description: 'Checkout URL' },
    400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid request or insufficient inventory' },
    404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart not found' },
    409: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart is not open' },
  },
});

app.openapi(checkoutCart, async (c) => {
  const { cartId } = c.req.valid('param');
  const { success_url, cancel_url, collect_shipping, shipping_countries, shipping_options } = c.req.valid('json');

  const stripeSecretKey = c.get('auth').stripeSecretKey;
  if (!stripeSecretKey) {
    throw ApiError.invalidRequest('Stripe not connected. POST /v1/setup/stripe first.');
  }

  const db = getDb(c.var.db);

  const statusUpdateResult = await db.run(
    `UPDATE carts SET status = 'checked_out', updated_at = ? WHERE id = ? AND status = 'open'`,
    [now(), cartId]
  );

  if (statusUpdateResult.changes === 0) {
    const [cart] = await db.query<any>(`SELECT * FROM carts WHERE id = ?`, [cartId]);
    if (!cart) throw ApiError.notFound('Cart not found');
    if (cart.status !== 'open') throw ApiError.conflict('Cart is not open');
    throw ApiError.invalidRequest('Failed to initiate checkout. Please try again.');
  }

  const [cart] = await db.query<any>(`SELECT * FROM carts WHERE id = ?`, [cartId]);
  if (!cart) throw ApiError.notFound('Cart not found');

  const items = await db.query<any>(`SELECT * FROM cart_items WHERE cart_id = ?`, [cartId]);
  if (items.length === 0) {
    await db.run(`UPDATE carts SET status = 'open', updated_at = ? WHERE id = ?`, [now(), cartId]);
    throw ApiError.invalidRequest('Cart is empty');
  }

  const subtotalCents = items.reduce((sum, item) => sum + item.unit_price_cents * item.qty, 0);

  const revertCartStatus = async () => {
    await db.run(`UPDATE carts SET status = 'open', updated_at = ? WHERE id = ?`, [now(), cartId]);
  };

  let discountAmountCents = 0;
  let discount: Discount | null = null;
  let discountReserved = false;

  if (cart.discount_id) {
    const [discountRow] = await db.query<any>(`SELECT * FROM discounts WHERE id = ?`, [
      cart.discount_id,
    ]);
    if (discountRow) {
      discount = discountRow as Discount;

      try {
        await validateDiscount(db, discount, subtotalCents, cart.customer_email);
      } catch (err) {
        await db.run(
          `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
          [cartId]
        );
        await revertCartStatus();
        if (err instanceof ApiError) throw err;
        throw ApiError.invalidRequest('Discount is no longer valid');
      }

      const currentTime = now();

      if (discount.usage_limit_per_customer !== null) {
        const [usage] = await db.query<any>(
          `SELECT COUNT(*) as count FROM discount_usage WHERE discount_id = ? AND customer_email = ?`,
          [discount.id, cart.customer_email.toLowerCase()]
        );
        if (usage && usage.count >= discount.usage_limit_per_customer) {
          await db.run(
            `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
            [cartId]
          );
          await revertCartStatus();
          throw ApiError.invalidRequest('You have already used this discount');
        }
      }

      if (discount.usage_limit !== null) {
        const result = await db.run(
          `UPDATE discounts 
           SET usage_count = usage_count + 1, updated_at = ? 
           WHERE id = ? 
             AND status = 'active'
             AND (starts_at IS NULL OR starts_at <= ?)
             AND (expires_at IS NULL OR expires_at >= ?)
             AND usage_count < usage_limit`,
          [currentTime, discount.id, currentTime, currentTime]
        );

        if (result.changes === 0) {
          await db.run(
            `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
            [cartId]
          );
          await revertCartStatus();
          throw ApiError.invalidRequest('Discount usage limit reached');
        }
        discountReserved = true;
      } else {
        const result = await db.run(
          `UPDATE discounts 
           SET updated_at = ? 
           WHERE id = ? 
             AND status = 'active'
             AND (starts_at IS NULL OR starts_at <= ?)
             AND (expires_at IS NULL OR expires_at >= ?)`,
          [currentTime, discount.id, currentTime, currentTime]
        );

        if (result.changes === 0) {
          await db.run(
            `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
            [cartId]
          );
          await revertCartStatus();
          throw ApiError.invalidRequest('Discount is no longer valid');
        }
      }

      discountAmountCents = calculateDiscount(discount, subtotalCents);
    } else {
      await db.run(
        `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
        [cartId]
      );
    }
  }

  const releaseReservedDiscount = async () => {
    if (discountReserved && discount) {
      await db.run(
        `UPDATE discounts SET usage_count = MAX(usage_count - 1, 0), updated_at = ? WHERE id = ?`,
        [now(), discount.id]
      );
    }
  };

  const reservedItems: { sku: string; qty: number }[] = [];

  const releaseReservedInventory = async () => {
    for (const item of reservedItems) {
      await db.run(
        `UPDATE inventory SET reserved = MAX(reserved - ?, 0), updated_at = ? WHERE sku = ?`,
        [item.qty, now(), item.sku]
      );
    }
    reservedItems.length = 0;
  };

  try {
    for (const item of items) {
      const result = await db.run(
        `UPDATE inventory SET reserved = reserved + ?, updated_at = ? 
         WHERE sku = ? AND on_hand - reserved >= ?`,
        [item.qty, now(), item.sku, item.qty]
      );

      if (result.changes === 0) {
        await releaseReservedInventory();
        throw ApiError.insufficientInventory(item.sku);
      }

      reservedItems.push({ sku: item.sku, qty: item.qty });
    }
  } catch (err) {
    await releaseReservedDiscount();
    await releaseReservedInventory();
    await revertCartStatus();
    throw err;
  }

  const stripe = new Stripe(stripeSecretKey);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: { name: item.title },
      unit_amount: item.unit_price_cents,
    },
    quantity: item.qty,
  }));

  let stripeCouponId: string | null = null;
  if (discount && discountAmountCents > 0) {
    const needsOnTheFlyCoupon = discount.type === 'percentage' && discount.max_discount_cents;

    if (discount.stripe_coupon_id && !needsOnTheFlyCoupon) {
      stripeCouponId = discount.stripe_coupon_id;
    } else if (stripeSecretKey) {
      try {
        const couponParams: Stripe.CouponCreateParams = {
          duration: 'once',
          metadata: { merchant_discount_id: discount.id },
        };

        if (discount.type === 'percentage' && discount.max_discount_cents) {
          couponParams.amount_off = discountAmountCents;
          couponParams.currency = 'usd';
        } else if (discount.type === 'percentage') {
          couponParams.percent_off = discount.value;
        } else {
          couponParams.amount_off = discount.value;
          couponParams.currency = 'usd';
        }

        const coupon = await stripe.coupons.create(couponParams);
        stripeCouponId = coupon.id;
      } catch (err: any) {
        await releaseReservedDiscount();
        await releaseReservedInventory();
        await revertCartStatus();
        console.error(`Failed to create Stripe coupon for discount: ${err.message}`);
        throw ApiError.invalidRequest(
          'Failed to apply discount. Please try again or remove the discount and proceed.'
        );
      }
    }
  }

  const defaultShippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: 0, currency: 'usd' },
        display_name: 'Standard Shipping',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 5 },
          maximum: { unit: 'business_day', value: 7 },
        },
      },
    },
  ];

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: cart.customer_email,
      automatic_tax: { enabled: true },
      ...(collect_shipping && {
        shipping_address_collection: {
          allowed_countries:
            shipping_countries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
        },
        shipping_options: shipping_options ?? defaultShippingOptions,
      }),
      line_items: lineItems,
      ...(stripeCouponId && { discounts: [{ coupon: stripeCouponId }] }),
      success_url,
      cancel_url,
      metadata: {
        cart_id: cartId,
        ...(discount && {
          discount_id: discount.id,
          discount_code: discount.code || '',
          discount_type: discount.type,
        }),
      },
    });
  } catch {
    await releaseReservedDiscount();
    await releaseReservedInventory();
    await revertCartStatus();
    throw ApiError.invalidRequest('Payment processing error. Please try again.');
  }

  await db.run(
    `UPDATE carts SET stripe_checkout_session_id = ?, discount_amount_cents = ?, updated_at = ? WHERE id = ?`,
    [session.id, discountAmountCents, now(), cartId]
  );

  return c.json({
    checkout_url: session.url!,
    stripe_checkout_session_id: session.id,
  }, 200);
});

const applyDiscount = createRoute({
  method: 'post',
  path: '/{cartId}/apply-discount',
  tags: ['Checkout'],
  summary: 'Apply discount code to cart',
  request: {
    params: CartIdParam,
    body: { content: { 'application/json': { schema: ApplyDiscountBody } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: ApplyDiscountResponse } }, description: 'Discount applied' },
    400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid discount' },
    404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart or discount not found' },
    409: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart is not open' },
  },
});

app.openapi(applyDiscount, async (c) => {
  const { cartId } = c.req.valid('param');
  const { code } = c.req.valid('json');
  const db = getDb(c.var.db);

  const [cart] = await db.query<any>(`SELECT * FROM carts WHERE id = ?`, [cartId]);
  if (!cart) throw ApiError.notFound('Cart not found');
  if (cart.status !== 'open') throw ApiError.conflict('Cart is not open');

  const normalizedCode = code.toUpperCase().trim();

  const [discount] = await db.query<any>(`SELECT * FROM discounts WHERE code = ?`, [normalizedCode]);
  if (!discount) throw ApiError.notFound('Discount code not found');

  const items = await db.query<any>(`SELECT * FROM cart_items WHERE cart_id = ?`, [cartId]);
  if (items.length === 0) throw ApiError.invalidRequest('Cart is empty');

  const subtotalCents = items.reduce((sum: number, item: any) => {
    return sum + item.unit_price_cents * item.qty;
  }, 0);

  await validateDiscount(db, discount as Discount, subtotalCents, cart.customer_email);
  const discountAmountCents = calculateDiscount(discount as Discount, subtotalCents);

  await db.run(
    `UPDATE carts SET discount_code = ?, discount_id = ?, discount_amount_cents = ? WHERE id = ?`,
    [discount.code, discount.id, discountAmountCents, cartId]
  );

  return c.json({
    discount: {
      code: discount.code,
      type: discount.type as 'percentage' | 'fixed_amount',
      amount_cents: discountAmountCents,
    },
    totals: {
      subtotal_cents: subtotalCents,
      discount_cents: discountAmountCents,
      shipping_cents: 0,
      tax_cents: 0,
      total_cents: subtotalCents - discountAmountCents,
    },
  }, 200);
});

const removeDiscount = createRoute({
  method: 'delete',
  path: '/{cartId}/discount',
  tags: ['Checkout'],
  summary: 'Remove discount from cart',
  request: { params: CartIdParam },
  responses: {
    200: { content: { 'application/json': { schema: RemoveDiscountResponse } }, description: 'Discount removed' },
    404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart not found' },
    409: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Cart is not open' },
  },
});

app.openapi(removeDiscount, async (c) => {
  const { cartId } = c.req.valid('param');
  const db = getDb(c.var.db);

  const [cart] = await db.query<any>(`SELECT * FROM carts WHERE id = ?`, [cartId]);
  if (!cart) throw ApiError.notFound('Cart not found');
  if (cart.status !== 'open') throw ApiError.conflict('Cart is not open');

  await db.run(
    `UPDATE carts SET discount_code = NULL, discount_id = NULL, discount_amount_cents = 0 WHERE id = ?`,
    [cartId]
  );

  const items = await db.query<any>(`SELECT * FROM cart_items WHERE cart_id = ?`, [cartId]);
  const subtotalCents = items.reduce((sum: number, item: any) => {
    return sum + item.unit_price_cents * item.qty;
  }, 0);

  return c.json({
    discount: null,
    totals: {
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      shipping_cents: 0,
      tax_cents: 0,
      total_cents: subtotalCents,
    },
  }, 200);
});

export { app as checkout };
