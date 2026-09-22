import { describe, expect, it } from 'vitest';
import {
  CLIENT_SAFE_ENV_VARS,
  isPostgresConfigured,
  pickClientEnv,
  usesSelfHostedData,
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

describe('usesSelfHostedData', () => {
  it('is false for managed instances, whatever else is set', () => {
    expect(usesSelfHostedData({ DL_ENV_TYPE: 'managed' })).toBe(false);
  });

  it('is true when no Supabase is configured, including an unset env type', () => {
    expect(usesSelfHostedData({})).toBe(true);
    expect(usesSelfHostedData({ DL_ENV_TYPE: 'dev' })).toBe(true);
    expect(usesSelfHostedData({ DL_ENV_TYPE: 'selfHosted' })).toBe(true);
  });

  /** SQLite is the default, and must not be mistaken for Supabase */
  it('is true for a SQLite install, which configures no DL_PG_* vars at all', () => {
    expect(usesSelfHostedData({ DL_ENV_TYPE: 'selfHosted' })).toBe(true);
    expect(
      usesSelfHostedData({ DL_ENV_TYPE: 'selfHosted', DL_SQLITE_PATH: '/data/dl.db' }),
    ).toBe(true);
  });

  /** The browser decides from DL_DB_BACKEND, so both must reach the same answer */
  it('agrees with the backend it reports to the browser', () => {
    const clientWouldSelfHost = (env: Record<string, string | undefined>) => {
      const forClient = pickClientEnv(env);
      if (env['DL_ENV_TYPE'] === 'managed') return false;
      const supabase = Boolean(
        forClient['SUPABASE_URL'] && forClient['SUPABASE_ANON_KEY'],
      );
      return !supabase || forClient['DL_DB_BACKEND'] === 'postgres';
    };

    const supabase = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' };
    const postgres = {
      DL_PG_HOST: 'h',
      DL_PG_USER: 'u',
      DL_PG_PASSWORD: 'p',
      DL_PG_NAME: 'n',
    };

    for (const env of [
      { DL_ENV_TYPE: 'selfHosted' },
      { DL_ENV_TYPE: 'dev' },
      {},
      { DL_ENV_TYPE: 'selfHosted', ...postgres },
      { DL_ENV_TYPE: 'selfHosted', ...supabase },
      { DL_ENV_TYPE: 'selfHosted', ...supabase, ...postgres },
      { DL_ENV_TYPE: 'dev', ...supabase },
      { DL_ENV_TYPE: 'managed', ...supabase },
    ]) {
      expect({ env, self: usesSelfHostedData(env) }).toEqual({
        env,
        self: clientWouldSelfHost(env),
      });
    }
  });

  it('defers to Supabase unless Postgres was asked for', () => {
    const supabase = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' };
    expect(usesSelfHostedData(supabase)).toBe(false);
    expect(
      usesSelfHostedData({
        ...supabase,
        DL_PG_HOST: 'db',
        DL_PG_USER: 'u',
        DL_PG_PASSWORD: 'p',
        DL_PG_NAME: 'n',
      }),
    ).toBe(true);
  });
});
