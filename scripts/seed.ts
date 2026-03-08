#!/usr/bin/env npx tsx
/**
 * Seed script - creates demo data via the API
 *
 * Usage:
 *   npx tsx scripts/seed.ts <api_url> <admin_key>
 *   npx tsx scripts/seed.ts http://localhost:8787 sk_...
 */

// images are embedded as base64 so this file can run even after the PNGs are removed
import { imageMap } from './image_map';
import {
  EUROPEAN_COUNTRIES,
  UK_COUNTRIES,
  US_COUNTRIES,
  OTHER_COUNTRIES,
} from './seed-data';

// helper converting SKUs to the filenames we generated above
const skuToImage: Record<string, string> = {
  // tee variants all use the same image regardless of size
  'TEE-BLK-S': 'tee-black.png',
  'TEE-BLK-M': 'tee-black.png',
  'TEE-BLK-L': 'tee-black.png',
  'TEE-WHT-S': 'tee-white.png',
  'TEE-WHT-M': 'tee-white.png',
  'TEE-WHT-L': 'tee-white.png',
  // hoodies share by colour
  'HOOD-BLK-M': 'hoodie-black.png',
  'HOOD-BLK-L': 'hoodie-black.png',
  'HOOD-GRY-M': 'hoodie-white.png',
  'HOOD-GRY-L': 'hoodie-white.png',
  // caps
  'CAP-BLK': 'cap-black.png',
  'CAP-NVY': 'cap-navy.png',
  // sticker pack
  'STICKER-5PK': 'stickers.png',
};

const API_URL = process.argv[2] || 'http://localhost:8787';
const API_KEY = process.argv[3];

if (!API_KEY) {
  console.log(`
🌱 Seed Script - Create demo data

Usage:
  npx tsx scripts/seed.ts <api_url> <admin_key>

Example:
  npx tsx scripts/seed.ts http://localhost:8787 sk_abc123...

First, start the API and create a store:
  npm run dev
  # Then in browser or curl, the first request will prompt you to set up
`);
  process.exit(1);
}

async function api(path: string, body?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${path}: ${err.error?.message || res.statusText}`);
  }

  return res.json();
}

async function apiWithRetry(path: string, body?: any, maxRetries = 5): Promise<any> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await api(path, body);
    } catch (error: any) {
      const message = error.message;
      
      // Check if it's a rate limit error
      if (message.includes('Rate limit exceeded')) {
        // Extract wait time from message or use exponential backoff
        const match = message.match(/Try again in (\d+) seconds/);
        const waitTime = match ? parseInt(match[1]) * 1000 : Math.pow(2, attempt) * 1000;
        
        attempt++;
        console.log(`   ⏳ Rate limited. Waiting ${waitTime}ms before retry (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw new Error(`Max retries exceeded for ${path}`);
}

async function seedRegions() {
  console.log('📋 Fetching existing currencies and countries...');
  
  // Fetch existing currencies
  const { items: currencies } = await api('/v1/regions/currencies');
  const currencyMap: Record<string, string> = {};
  for (const curr of currencies) {
    currencyMap[curr.code] = curr.id;
  }

  // Fetch all countries in one batch request (no pagination)
  const countriesResponse = await api('/v1/regions/countries/batch');
  const countryMap: Record<string, string> = {};
  
  for (const country of countriesResponse.items) {
    countryMap[country.code] = country.id;
  }
  
  // Debug: verify we have countries
  if (Object.keys(countryMap).length === 0) {
    console.error('❌ No countries found! Make sure to run init.ts first.');
    process.exit(1);
  }
  
  console.log(`   Found ${Object.keys(countryMap).length} countries in database`);
  
  // Log sample countries
  const sampleCodes = ['FR', 'GB', 'US', 'IT'];
  const missingCodes = sampleCodes.filter(code => !countryMap[code]);
  if (missingCodes.length > 0) {
    console.warn(`   ⚠️  Missing country codes: ${missingCodes.join(', ')}`);
  }

  console.log('🏢 Creating warehouses...');
  const warehouse_fr = await api('/v1/regions/warehouses', {
    display_name: 'France Distribution Center',
    address_line1: '218 route Notre Dame de la Gorge',
    city: 'Les Contamines-Montjoie',
    postal_code: '74170',
    country_code: 'FR',
    priority: 1,
  });

  const warehouse_it = await api('/v1/regions/warehouses', {
    display_name: 'Italy Distribution Center',
    address_line1: '17 piazza San Marco',
    city: 'Venezia',
    postal_code: '30124',
    country_code: 'IT',
    priority: 2,
  });

  console.log('📦 Creating shipping rates...');
  const shippingRate = await api('/v1/regions/shipping-rates', {
    display_name: 'Standard Shipping',
    description: 'Standard international shipping',
    min_delivery_days: 5,
    max_delivery_days: 10,
  });

  // Add shipping rate prices for each currency
  await api(`/v1/regions/shipping-rates/${shippingRate.id}/prices`, {
    currency_id: currencyMap.EUR,
    amount_cents: 999, // €9.99
  });

  await api(`/v1/regions/shipping-rates/${shippingRate.id}/prices`, {
    currency_id: currencyMap.GBP,
    amount_cents: 799, // £7.99
  });

  await api(`/v1/regions/shipping-rates/${shippingRate.id}/prices`, {
    currency_id: currencyMap.USD,
    amount_cents: 1299, // $12.99
  });

  console.log('🗺️ Creating regions...');

  // Europe region
  const region_eu = await api('/v1/regions', {
    display_name: 'Europe',
    currency_id: currencyMap.EUR,
    is_default: true,
  });

  // Add countries to Europe
  for (const country of EUROPEAN_COUNTRIES) {
    const countryId = countryMap[country.code];
    if (!countryId) {
      console.warn(`   ⚠️  Country not found in database: ${country.code} (${country.display_name}). Skipping.`);
      continue;
    }
    await api(`/v1/regions/${region_eu.id}/countries`, {
      country_id: countryId,
    });
  }

  // Add warehouses to Europe
  await api(`/v1/regions/${region_eu.id}/warehouses`, { warehouse_id: warehouse_fr.id });
  await api(`/v1/regions/${region_eu.id}/warehouses`, { warehouse_id: warehouse_it.id });

  // Add shipping rates to Europe
  await api(`/v1/regions/${region_eu.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  // UK region
  const region_uk = await api('/v1/regions', {
    display_name: 'United Kingdom',
    currency_id: currencyMap.GBP,
    is_default: false,
  });

  for (const country of UK_COUNTRIES) {
    const countryId = countryMap[country.code];
    if (!countryId) {
      console.warn(`   ⚠️  Country not found in database: ${country.code} (${country.display_name}). Skipping.`);
      continue;
    }
    await api(`/v1/regions/${region_uk.id}/countries`, {
      country_id: countryId,
    });
  }

  await api(`/v1/regions/${region_uk.id}/warehouses`, { warehouse_id: warehouse_fr.id });
  await api(`/v1/regions/${region_uk.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  // US region
  const region_us = await api('/v1/regions', {
    display_name: 'North America',
    currency_id: currencyMap.USD,
    is_default: false,
  });

  for (const country of US_COUNTRIES) {
    const countryId = countryMap[country.code];
    if (!countryId) {
      console.warn(`   ⚠️  Country not found in database: ${country.code} (${country.display_name}). Skipping.`);
      continue;
    }
    await api(`/v1/regions/${region_us.id}/countries`, {
      country_id: countryId,
    });
  }

  await api(`/v1/regions/${region_us.id}/warehouses`, { warehouse_id: warehouse_it.id });
  await api(`/v1/regions/${region_us.id}/warehouses`, { warehouse_id: warehouse_fr.id });
  await api(`/v1/regions/${region_us.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  // World region
  const region_world = await api('/v1/regions', {
    display_name: 'Rest of World',
    currency_id: currencyMap.EUR,
    is_default: false,
  });

  for (const country of OTHER_COUNTRIES) {
    const countryId = countryMap[country.code];
    if (!countryId) {
      console.warn(`   ⚠️  Country not found in database: ${country.code} (${country.display_name}). Skipping.`);
      continue;
    }
    await api(`/v1/regions/${region_world.id}/countries`, {
      country_id: countryId,
    });
  }

  await api(`/v1/regions/${region_world.id}/warehouses`, { warehouse_id: warehouse_fr.id });
  await api(`/v1/regions/${region_world.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  return {
    warehouses: { fr: warehouse_fr.id, it: warehouse_it.id },
    regions: { eu: region_eu.id, uk: region_uk.id, us: region_us.id, world: region_world.id },
  };
}

async function seed() {
  console.log('🌱 Seeding demo data...\n');

  // Create regions and other data
  const regionData = await seedRegions();

  // Products
  const products = [
    {
      title: 'Classic Tee',
      description: 'Premium cotton t-shirt. Soft, breathable, and built to last.',
    },
    { title: 'Hoodie', description: 'Cozy pullover hoodie. Perfect for coding sessions.' },
    { title: 'Cap', description: 'Embroidered baseball cap. One size fits most.' },
    {
      title: 'Sticker Pack',
      description: 'Set of 5 die-cut vinyl stickers. Waterproof and durable.',
    },
  ];

  const variants: Record<string, any[]> = {
    'Classic Tee': [
      { sku: 'TEE-BLK-S', title: 'Black / S', price_cents: 2999, weight_g: 180, stock: 50 },
      { sku: 'TEE-BLK-M', title: 'Black / M', price_cents: 2999, weight_g: 200, stock: 75 },
      { sku: 'TEE-BLK-L', title: 'Black / L', price_cents: 2999, weight_g: 220, stock: 60 },
      { sku: 'TEE-WHT-S', title: 'White / S', price_cents: 2999, weight_g: 180, stock: 40 },
      { sku: 'TEE-WHT-M', title: 'White / M', price_cents: 2999, weight_g: 200, stock: 55 },
      { sku: 'TEE-WHT-L', title: 'White / L', price_cents: 2999, weight_g: 220, stock: 45 },
    ],
    Hoodie: [
      { sku: 'HOOD-BLK-M', title: 'Black / M', price_cents: 5999, weight_g: 450, stock: 30 },
      { sku: 'HOOD-BLK-L', title: 'Black / L', price_cents: 5999, weight_g: 500, stock: 25 },
      { sku: 'HOOD-GRY-M', title: 'Gray / M', price_cents: 5999, weight_g: 450, stock: 20 },
      { sku: 'HOOD-GRY-L', title: 'Gray / L', price_cents: 5999, weight_g: 500, stock: 15 },
    ],
    Cap: [
      { sku: 'CAP-BLK', title: 'Black', price_cents: 2499, weight_g: 100, stock: 100 },
      { sku: 'CAP-NVY', title: 'Navy', price_cents: 2499, weight_g: 100, stock: 80 },
    ],
    'Sticker Pack': [
      { sku: 'STICKER-5PK', title: '5 Pack', price_cents: 999, weight_g: 20, stock: 200 },
    ],
  };

  for (const prod of products) {
    console.log(`📦 Creating ${prod.title}...`);

    const product = await api('/v1/products', prod);

    for (const v of variants[prod.title]) {
      const { stock, ...variant } = v;

      // attach an image if we know which file corresponds to this SKU
      const imgFile = skuToImage[variant.sku];
      if (imgFile) {
        variant.image_url = imageMap[imgFile];
      }

      console.log(`   └─ ${variant.sku}`);

      await api(`/v1/products/${product.id}/variants`, variant);

      // Add warehouse inventory
      // Special case: 10 TEE-BLK-S in Italy, rest in France
      if (variant.sku === 'TEE-BLK-S') {
        // 10 in Italy
        await api(`/v1/inventory/${encodeURIComponent(variant.sku)}/warehouse-adjust`, {
          warehouse_id: regionData.warehouses.it,
          delta: 10,
          reason: 'restock',
        });
        // Rest (40, 35, 10) in France based on sizes
        const stock_fr = stock - 10;
        await api(`/v1/inventory/${encodeURIComponent(variant.sku)}/warehouse-adjust`, {
          warehouse_id: regionData.warehouses.fr,
          delta: stock_fr,
          reason: 'restock',
        });
      } else {
        // All other SKUs go to France warehouse
        await api(`/v1/inventory/${encodeURIComponent(variant.sku)}/warehouse-adjust`, {
          warehouse_id: regionData.warehouses.fr,
          delta: stock,
          reason: 'restock',
        });
      }
    }
  };

  // Create test orders across different regions
  console.log('\n🛒 Creating test orders...');

  const testOrdersByRegion: Record<string, Array<{ customer_email: string; items: Array<{ sku: string; qty: number }> }>> = {
    eu: [
      {
        customer_email: 'sarah@eu.example.com',
        items: [
          { sku: 'TEE-BLK-M', qty: 2 },
          { sku: 'CAP-BLK', qty: 1 },
        ],
      },
      {
        customer_email: 'mike@eu.example.com',
        items: [{ sku: 'HOOD-BLK-L', qty: 1 }],
      },
      {
        customer_email: 'emma@eu.example.com',
        items: [
          { sku: 'TEE-WHT-S', qty: 1 },
          { sku: 'TEE-WHT-M', qty: 1 },
          { sku: 'CAP-NVY', qty: 2 },
        ],
      },
    ],
    uk: [
      {
        customer_email: 'james@uk.example.com',
        items: [
          { sku: 'HOOD-GRY-M', qty: 1 },
          { sku: 'TEE-BLK-L', qty: 2 },
        ],
      },
      {
        customer_email: 'olivia@uk.example.com',
        items: [{ sku: 'CAP-BLK', qty: 1 }],
      },
    ],
    us: [
      {
        customer_email: 'noah@us.example.com',
        items: [
          { sku: 'TEE-BLK-S', qty: 1 },
          { sku: 'TEE-WHT-L', qty: 1 },
          { sku: 'HOOD-BLK-M', qty: 1 },
        ],
      },
      {
        customer_email: 'ava@us.example.com',
        items: [{ sku: 'HOOD-GRY-L', qty: 2 }],
      },
      {
        customer_email: 'liam@us.example.com',
        items: [
          { sku: 'TEE-BLK-M', qty: 1 },
          { sku: 'CAP-NVY', qty: 1 },
        ],
      },
    ],
  };

  // Create orders for each region
  for (const [regionKey, orders] of Object.entries(testOrdersByRegion)) {
    const regionId = regionData.regions[regionKey as keyof typeof regionData.regions];
    
    for (const order of orders) {
      const result = await api('/v1/orders/test', {
        ...order,
        region_id: regionId,
      });
      const itemsSummary = order.items.map((i) => `${i.qty}x ${i.sku}`).join(', ');
      console.log(`   └─ [${regionKey.toUpperCase()}] ${result.number}: ${order.customer_email} (${itemsSummary})`);
    }
  }

  console.log('\n✅ Done! Demo data created.\n');

  // Show summary
  const { items: allProducts } = await api('/v1/products');
  const { items: allOrders } = await api('/v1/orders');
  console.log(`Products: ${allProducts.length}`);
  console.log(
    `Variants: ${allProducts.reduce((sum: number, p: any) => sum + p.variants.length, 0)}`
  );
  console.log(`Orders: ${allOrders.length}`);

  const totalRevenue = allOrders.reduce((sum: number, o: any) => sum + o.amounts.total_cents, 0);
  console.log(`Revenue: $${(totalRevenue / 100).toFixed(2)}`);

  console.log(`\n📊 Admin dashboard: cd admin && npm run dev`);
  console.log(`   Connect with: ${API_URL}`);
}

seed().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
