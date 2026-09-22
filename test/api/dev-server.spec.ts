import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, startDevServer, type RunningServer } from '../helpers/server';

/**
 * Analog's dev server hands only `/api` requests to Nitro, so without the
 * prefix rewrite in vite.config every /v1 call falls through to the app and
 * comes back as the 404 page. Production is unaffected, which is why this
 * needs covering separately.
 */
describe('/v1 API on the dev server', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startDevServer();
  }, 180_000);

  afterAll(() => server?.stop());

  it('serves reads as JSON rather than the app 404 page', async () => {
    const response = await fetch(`${server.url}/v1/domains`, {
      headers: { Origin: server.url },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual([]);
  });

  it('serves writes, and reads them back', async () => {
    const created = await api<{ domain_name: string }>(server, '/v1/domains', {
      method: 'POST',
      body: JSON.stringify({
        domain: { domain_name: 'dev-server.com', notes: '' },
        tags: ['dev'],
        notifications: [],
        subdomains: [],
      }),
    });
    expect(created.status).toBe(200);
    expect(created.body.domain_name).toBe('dev-server.com');

    const listed = await api<{ domain_name: string }[]>(server, '/v1/domains');
    expect(listed.body.map((domain) => domain.domain_name)).toEqual(['dev-server.com']);
  });

  it('keeps error codes and bodies intact, not swallowed by the proxy', async () => {
    const notFound = await api<{ error: { code: string } }>(
      server,
      '/v1/domains/00000000-0000-4000-8000-000000000000',
    );
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe('not_found');

    const forbidden = await api<{ error: { code: string } }>(server, '/v1/domains', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('forbidden');
  });

  it('still serves the legacy /api routes', async () => {
    const { status, body } = await api<{ status: string }>(server, '/api/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });
});
