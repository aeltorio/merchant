# Multi-Region Integration Tests

Integration tests for the multi-region features of the Merchant API.

## Prerequisites

1. **Environment Variables**: Ensure your project root `.env` file contains:
   ```
   MERCHANT_SK=sk_xxxxx...
   MERCHANT_PK=pk_xxxxx...
   ```

2. **Development Server**: The integration tests require the API server to be running:
   ```bash
   cd apps/merchant
   npm run dev:env
   ```

3. **Port**: Tests expect the server to be running on `http://localhost:8787`

## Running Tests

### Option 1: Using npm script (Easiest)
```bash
cd apps/merchant
npm run test:regions
```

This will:
- Check if the dev server is running
- Verify API keys are available
- Run the full integration test suite
- Clean up test data after completion

### Option 2: Manually with vitest
```bash
cd apps/merchant
npx vitest run tests/regions.integration.test.ts --reporter=verbose
```

### Option 3: Watch mode (for development)
```bash
cd apps/merchant
npx vitest tests/regions.integration.test.ts --watch
```

## Test Coverage

The integration test suite covers:

### Currencies
- ✅ Create a currency
- ✅ List currencies
- ✅ Get currency by ID
- ✅ Update currency
- ✅ Reject duplicate currency codes

### Countries
- ✅ Create a country
- ✅ List countries (sorted by name)
- ✅ Update country details

### Warehouses
- ✅ Create a warehouse with priority
- ✅ List warehouses (sorted by priority)
- ✅ Update warehouse priority

### Shipping Rates
- ✅ Create shipping rate
- ✅ List shipping rates
- ✅ Add price to shipping rate for specific currency

### Regions
- ✅ Create a region
- ✅ List regions
- ✅ Set region as default
- ✅ Add country to region
- ✅ Add warehouse to region
- ✅ Add shipping rate to region

### Region-Aware Checkout
- ✅ Create cart with specific region
- ✅ Create cart with default region
- ✅ Verify currency selection
- ✅ Enforce admin-only access

### Error Handling
- ✅ 404 for non-existent resources
- ✅ 400 for invalid request bodies
- ✅ 401 for missing authorization
- ✅ Detailed error messages with constraint violations

## Test Structure

Each test:
1. Creates test data (currencies, countries, etc.)
2. Performs the operation being tested
3. Validates the response
4. Stores IDs for cleanup

At the end of the test suite:
- All created resources are deleted in reverse order
- Foreign key constraints are respected during cleanup
- Error messages from cleanup failures are logged (non-fatal)

## Example Output

```
✓ Multi-Region Integration Tests (12 tests)
  ✓ Currencies (5 tests)
    ✓ should create a currency
    ✓ should list currencies
    ✓ should get a currency by id
    ✓ should update a currency
    ✓ should reject duplicate currency code
  ✓ Countries (3 tests)
  ✓ Warehouses (3 tests)
  ✓ Shipping Rates (3 tests)
  ✓ Regions (7 tests)
  ✓ Region-Aware Checkout (3 tests)
  ✓ Error Handling (3 tests)

✅ Integration tests complete!
```

## Troubleshooting

### "Dev server not running"
Start the dev server in a separate terminal:
```bash
cd apps/merchant
npm run dev:env
```

### "MERCHANT_SK/MERCHANT_PK not found"
Ensure your project root `.env` file has these variables set with valid API keys.

### "Admin access required"
Tests that should have admin access failed. Verify MERCHANT_SK is correctly set in `.env`.

### Cleanup fails
If cleanup operations fail (non-critical), it usually means test data was already deleted. This is safe to ignore.

## Writing Additional Tests

To add more tests to the suite:

1. Add a new `describe` block in `regions.integration.test.ts`
2. Create `it()` test cases
3. Use the `api()` helper function to make requests
4. Store created IDs in `testData` for cleanup
5. Verify responses with `expect()`

Example:
```typescript
describe('My Feature', () => {
  it('should do something', async () => {
    const result = await api('/v1/my-endpoint', 'POST', {
      field: 'value',
    });
    
    expect(result.id).toBeDefined();
    testData.myResources = testData.myResources || [];
    testData.myResources.push(result.id);
  });
});
```

## Notes

- Tests create real data in the database (on localhost)
- Test data is automatically cleaned up after tests complete
- Tests use the admin API key (MERCHANT_SK) for all operations
- Tests verify authorization by trying public key access on admin endpoints
