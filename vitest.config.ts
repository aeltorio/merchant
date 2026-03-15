import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'tests/auth.test.ts'], // Skip auth.test.ts - requires cloudflare:workers
    testTimeout: 30000, // 30s for integration tests with rate limiting
    hookTimeout: 30000, // 30s for beforeAll/afterAll cleanup
  },
});
