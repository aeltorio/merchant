import { type MerchantDO } from './do';

export type Env = {
  MERCHANT: DurableObjectNamespace<MerchantDO>;
  IMAGES?: R2Bucket;
  IMAGES_URL?: string;
  STORE_NAME?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  /**
   * Domain configured in Auth0 (e.g. `your-tenant.auth0.com`).
   * Required when validating JWTs issued by Auth0.
   */
  AUTH0_DOMAIN?: string;

  /**
   * Expected audience claim for incoming JWTs. Typically the API identifier
   * configured in your Auth0 application settings.
   */
  AUTH0_AUDIENCE?: string;

  /**
   * Permission string required on incoming Auth0 tokens to be treated as an
   * admin user.  Defaults to `admin:store` when not set.
   */
  ADMIN_STORE_PERMISSION?: string;

  /**
   * Permission string used to guard the `/api/__auth0/token` endpoint.  Any
   * caller must be authenticated and have this permission to request a Management
   * API token.  If unset the route is open to admins only.
   */
  ADMIN_AUTH0_PERMISSION?: string;

  /**
   * Comma-separated list of permissions to automatically assign to the current
   * user when hitting `/api/__auth0/autopermissions`.
   */
  AUTH0_AUTOMATIC_PERMISSIONS?: string;
};

export type DOStub = {
  query: <T = unknown>(sql: string, params: unknown[]) => Promise<T[]>;
  run: (sql: string, params: unknown[]) => Promise<{ changes: number }>;
  broadcast: (event: { type: string; data: unknown; timestamp: string }) => void;
};

export type Variables = {
  db: DOStub;
  auth: AuthContext;
};

export type HonoEnv = {
  Bindings: Env;
  Variables: Variables;
};

export type AuthRole = 'public' | 'admin' | 'oauth';

export type AuthContext = {
  role: AuthRole;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  oauthScopes?: string[];
  customerEmail?: string;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError('unauthorized', 401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError('forbidden', 403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError('not_found', 404, message);
  }

  static invalidRequest(message: string, details?: Record<string, unknown>) {
    return new ApiError('invalid_request', 400, message, details);
  }

  static conflict(message: string) {
    return new ApiError('conflict', 409, message);
  }

  static insufficientInventory(sku: string) {
    return new ApiError('insufficient_inventory', 409, `Insufficient inventory for SKU: ${sku}`, {
      sku,
    });
  }

  static stripeError(message: string) {
    return new ApiError('stripe_error', 502, message);
  }
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ORD-${datePart}-${suffix}`;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
