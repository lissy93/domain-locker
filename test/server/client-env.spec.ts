import { describe, expect, it } from 'vitest';
import {
  CLIENT_SAFE_ENV_VARS,
  isPostgresConfigured,
  pickClientEnv,
} from '~/server/utils/client-env';

const SECRETS = [
  'DL_PG_PASSWORD',
  'DL_PG_USER',
  'DL_PG_HOST',
  'DL_PG_PORT',
  'DL_PG_NAME',
  'RESEND_KEY',
  'STRIPE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'HEALTHCHECKS_API_KEY',
  'NOTIFY_WEBHOOK_TOKEN',
  'NOTIFY_WEBHOOK_PASSWORD',
];

describe('client env allowlist', () => {
  const fullEnv = {
    DL_ENV_TYPE: 'selfHosted',
    DL_BASE_URL: 'http://localhost:3000',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    ...Object.fromEntries(SECRETS.map((name) => [name, `secret-${name}`])),
  };

  it('never exposes a secret to the browser', () => {
    const picked = pickClientEnv(fullEnv);
    for (const secret of SECRETS) {
      expect(picked, `${secret} leaked`).not.toHaveProperty(secret);
    }
    expect(JSON.stringify(picked)).not.toMatch(/secret-/);
  });

  it('passes through the variables the client genuinely needs', () => {
    const picked = pickClientEnv(fullEnv);
    expect(picked['DL_ENV_TYPE']).toBe('selfHosted');
    expect(picked['SUPABASE_URL']).toBe('https://project.supabase.co');
    expect(picked['SUPABASE_ANON_KEY']).toBe('anon-key');
  });

  it('names the backend rather than exposing credentials', () => {
    expect(pickClientEnv(fullEnv)['DL_DB_BACKEND']).toBe('postgres');
    expect(pickClientEnv({ DL_ENV_TYPE: 'selfHosted' })['DL_DB_BACKEND']).toBe('sqlite');
  });

  it('names no backend on managed, where data lives in Supabase', () => {
    expect(pickClientEnv({ DL_ENV_TYPE: 'managed' })).not.toHaveProperty('DL_DB_BACKEND');
  });

  it('treats a partially configured Postgres as unconfigured', () => {
    expect(isPostgresConfigured({ DL_PG_HOST: 'db', DL_PG_USER: 'postgres' })).toBe(
      false,
    );
  });

  it('omits variables that are not set at all', () => {
    expect(pickClientEnv({})).toEqual({ DL_DB_BACKEND: 'sqlite' });
  });

  it('allowlists only the two keys that are public by design', () => {
    const keyLike = CLIENT_SAFE_ENV_VARS.filter((name) =>
      /PASSWORD|SECRET|_KEY$|TOKEN/.test(name),
    );
    expect(keyLike).toEqual(['DL_TURNSTILE_KEY', 'SUPABASE_ANON_KEY']);
  });
});
