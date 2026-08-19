import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, isBuilt, startServer, type RunningServer } from '../helpers/server';

const built = isBuilt();

/**
 * Managed instances keep serving their data through Supabase. The self-hosted
 * API must never answer there, or it would quietly stand up its own database.
 */
describe.skipIf(!built)('/v1 API on a managed instance', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer({ DL_ENV_TYPE: 'managed' });
  }, 60_000);

  afterAll(() => server?.stop());

  it('refuses to serve reads', async () => {
    const { status, body } = await api<{ error: { code: string } }>(
      server,
      '/v1/domains',
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });

  it('refuses to serve writes', async () => {
    const { status } = await api(server, '/v1/domains', {
      method: 'POST',
      body: JSON.stringify({ domain: { domain_name: 'managed.com' } }),
    });
    expect(status).toBe(403);
  });

  it('refuses the job triggers', async () => {
    const { status } = await api(server, '/api/domain-monitor', { method: 'POST' });
    expect(status).toBe(403);
  });

  it('does not expose the self-hosted env endpoint', async () => {
    const { body } = await api<{ error: boolean }>(server, '/api/env-var');
    expect(body.error).toBe(true);
  });
});
