import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvService } from '~/app/services/environment.service';

// Stands in for whatever .env the machine running the tests happens to have
vi.mock('~/app/utils/client-env', () => ({ BUILD_ENV: {} }));

/**
 * Which backend the browser talks to is decided here, and getting it wrong
 * sends a Supabase user's data to the server's own database instead
 */
describe('EnvService.isSelfHostedDatabase', () => {
  let service: EnvService;

  const setEnv = (env: Record<string, string>) => {
    (window as unknown as { __env: Record<string, string> }).__env = env;
  };

  const supabase = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [EnvService] });
    service = TestBed.inject(EnvService);
  });

  it('uses Supabase on a managed instance', () => {
    setEnv({ DL_ENV_TYPE: 'managed', ...supabase });
    expect(service.isSelfHostedDatabase()).toBe(false);
  });

  it('uses Supabase in dev, where the server still reports a SQLite fallback', () => {
    setEnv({ DL_ENV_TYPE: 'dev', DL_DB_BACKEND: 'sqlite', ...supabase });
    expect(service.isSelfHostedDatabase()).toBe(false);
  });

  it('uses Supabase when self-hosted against it, rather than the local database', () => {
    setEnv({ DL_ENV_TYPE: 'selfHosted', DL_DB_BACKEND: 'sqlite', ...supabase });
    expect(service.isSelfHostedDatabase()).toBe(false);
  });

  it('uses the server when Postgres was configured, even with Supabase set', () => {
    setEnv({ DL_ENV_TYPE: 'selfHosted', DL_DB_BACKEND: 'postgres', ...supabase });
    expect(service.isSelfHostedDatabase()).toBe(true);
  });

  it('uses the server when no Supabase credentials are given', () => {
    setEnv({ DL_ENV_TYPE: 'selfHosted', DL_DB_BACKEND: 'sqlite' });
    expect(service.isSelfHostedDatabase()).toBe(true);
  });

  it('uses the server when only half of the Supabase credentials are given', () => {
    setEnv({ DL_ENV_TYPE: 'selfHosted', SUPABASE_URL: supabase.SUPABASE_URL });
    expect(service.isSelfHostedDatabase()).toBe(true);
  });
});
