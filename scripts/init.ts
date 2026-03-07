#!/usr/bin/env npx tsx

import path from 'path';
import { config as loadEnv } from 'dotenv';

// calculate directory of current module (ESM compatible)
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// load .env from workspace root (three levels up)
loadEnv({ path: path.resolve(__dirname, '../../..', '.env') });

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateApiKey(prefix: 'pk' | 'sk'): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${key}`;
}

async function init() {
  const isRemote = process.argv.includes('--remote');
  const baseUrl = isRemote 
    ? process.env.MERCHANT_URL || 'https://merchant.your-domain.workers.dev'
    : 'http://localhost:8787';
  const envLabel = isRemote ? 'PRODUCTION' : 'LOCAL';
  
  console.log(`🚀 Initializing merchant (${envLabel})...\n`);

  if (isRemote && !process.env.MERCHANT_URL) {
    console.log('⚠️  Set MERCHANT_URL env var for remote init, e.g.:');
    console.log('   MERCHANT_URL=https://merchant.example.com npx tsx scripts/init.ts --remote\n');
  }

  // if the keys are provided via environment we reuse them instead of generating new ones
  let publicKey = process.env.MERCHANT_PK || '';
  let adminKey = process.env.MERCHANT_SK || '';

  if (!publicKey || !adminKey) {
    publicKey = generateApiKey('pk');
    adminKey = generateApiKey('sk');
  }

  const publicHash = await hashKey(publicKey);
  const adminHash = await hashKey(adminKey);
  const publicId = crypto.randomUUID();
  const adminId = crypto.randomUUID();

  console.log('🔑 Creating API keys via /v1/setup/init...');
  
  const response = await fetch(`${baseUrl}/v1/setup/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keys: [
        { id: publicId, key_hash: publicHash, key_prefix: 'pk_', role: 'public' },
        { id: adminId, key_hash: adminHash, key_prefix: 'sk_', role: 'admin' },
      ]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create API keys: ${response.status} ${error}`);
  }

  console.log('\n✅ Merchant initialized!\n');
  console.log('─'.repeat(50));
  console.log('\n🔑 API Keys (save these, shown only once):\n');
  console.log(`   Public:  ${publicKey}`);
  console.log(`   Admin:   ${adminKey}`);
  console.log('\n' + '─'.repeat(50));
  console.log('\n📝 Next steps:\n');
  console.log('   1. Start the API:');
  console.log('      npm run dev\n');
  console.log('   2. Connect Stripe (optional for testing):');
  console.log(`      curl -X POST ${baseUrl}/v1/setup/stripe \\`);
  console.log(`        -H "Authorization: Bearer ${adminKey}" \\`);
  console.log(`        -H "Content-Type: application/json" \\`);
  console.log(
    `        -d '{"stripe_secret_key":"sk_test_...","stripe_webhook_secret":"whsec_..."}'\n`
  );
  console.log('   3. Seed demo data:');
  console.log(`      npx tsx scripts/seed.ts ${baseUrl} ${adminKey}\n`);
  console.log('   4. Start admin dashboard:');
  console.log('      cd admin && npm install && npm run dev\n');
}

init().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
