/**
 * Environment variables the browser is allowed to see. Anything absent here
 * (database credentials, API keys, tokens) stays server-side, whether it is
 * requested via /api/env-var or bundled at build time.
 */
export const CLIENT_SAFE_ENV_VARS = [
  'DL_BASE_URL',
  'DL_ENV_TYPE',
  'DL_DEBUG',
  'DL_GLITCHTIP_DSN',
  'DL_PLAUSIBLE_URL',
  'DL_PLAUSIBLE_SITE',
  'DL_TURNSTILE_KEY',
  'DL_DOMAIN_INFO_API',
  'DL_DOMAIN_SUBS_API',
  'DL_DEMO_USER',
  'DL_DEMO_PASS',
  'DL_DISABLE_WRITE_METHODS',
  'DL_SUPABASE_PROJECT',
  'DL_STRIPE_CHECKOUT_URL',
  'DL_STRIPE_CANCEL_URL',
  'DL_STRIPE_INFO_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
] as const;

/** Tells the client which database the server is using, never how to reach it */
export const DB_BACKEND_VAR = 'DL_DB_BACKEND';

const PG_REQUIRED_VARS = ['DL_PG_HOST', 'DL_PG_USER', 'DL_PG_PASSWORD', 'DL_PG_NAME'];

export function isPostgresConfigured(env: Record<string, string | undefined>): boolean {
  return PG_REQUIRED_VARS.every((name) => Boolean(env[name]));
}

/** Picks the allowlisted variables out of an environment, plus the backend name */
export function pickClientEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of CLIENT_SAFE_ENV_VARS) {
    if (env[name] !== undefined) picked[name] = env[name] as string;
  }
  if (env['DL_ENV_TYPE'] !== 'managed') {
    picked[DB_BACKEND_VAR] = isPostgresConfigured(env) ? 'postgres' : 'sqlite';
  }
  return picked;
}
