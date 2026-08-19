import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, isBuilt, startServer, type RunningServer } from '../helpers/server';

const built = isBuilt();

/** Exercises the shipped server over HTTP, on a zero-config SQLite database */
describe.skipIf(!built)('/v1 API over HTTP', () => {
  let server: RunningServer;
  let domainId: string;

  beforeAll(async () => {
    server = await startServer();
  }, 60_000);

  afterAll(() => server?.stop());

  it('starts with an empty portfolio on a brand new database', async () => {
    const { status, body } = await api<unknown[]>(server, '/v1/domains');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('creates a domain with its relations', async () => {
    const { status, body } = await api<{ id: string; tags: string[] }>(
      server,
      '/v1/domains',
      {
        method: 'POST',
        body: JSON.stringify({
          domain: {
            domain_name: 'http-test.com',
            notes: 'Created over HTTP',
            registrar: { name: 'Gandi', url: 'https://gandi.net' },
          },
          tags: ['prod'],
          ipAddresses: [{ ipAddress: '1.2.3.4', isIpv6: false }],
          dns: { nameServers: ['ns1.gandi.net'] },
          statuses: ['clientHold'],
        }),
      },
    );

    expect(status).toBe(200);
    expect(body.tags).toEqual(['prod']);
    domainId = body.id;
  });

  it('reads the domain back by id and by name', async () => {
    const byId = await api<{ domain_name: string }>(server, `/v1/domains/${domainId}`);
    expect(byId.status).toBe(200);
    expect(byId.body.domain_name).toBe('http-test.com');

    const byName = await api<{ id: string }>(server, '/v1/domains/by-name/http-test.com');
    expect(byName.body.id).toBe(domainId);
  });

  it('serves the summary endpoints', async () => {
    expect((await api(server, '/v1/domains/names')).body).toEqual(['http-test.com']);
    expect((await api(server, '/v1/domains/count')).body).toEqual({ total: 1 });
    expect((await api(server, '/v1/domains/statuses')).body).toEqual([
      { eppCode: 'clientHold', domainCount: 1 },
    ]);
    expect((await api(server, '/v1/assets/counts?type=dns_records')).body).toEqual({
      total: 1,
    });
    expect((await api(server, '/v1/assets/ips?ipv6=false')).body).toEqual([
      { ip_address: '1.2.3.4', domains: ['http-test.com'] },
    ]);
  });

  it('updates a domain', async () => {
    const { status, body } = await api<{ notes: string; tags: string[] }>(
      server,
      `/v1/domains/${domainId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          domain: { domain_name: 'http-test.com', notes: 'Edited' },
          tags: ['archived'],
        }),
      },
    );
    expect(status).toBe(200);
    expect(body.notes).toBe('Edited');
    expect(body.tags).toEqual(['archived']);
  });

  it('rejects a duplicate domain with a conflict', async () => {
    const { status, body } = await api<{ error: { code: string } }>(
      server,
      '/v1/domains',
      {
        method: 'POST',
        body: JSON.stringify({ domain: { domain_name: 'http-test.com' } }),
      },
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('conflict');
  });

  it('reports validation failures with the offending field', async () => {
    const { status, body } = await api<{
      error: { code: string; details: { path: string }[] };
    }>(server, '/v1/domains', {
      method: 'POST',
      body: JSON.stringify({ domain: { domain_name: '' } }),
    });

    expect(status).toBe(400);
    expect(body.error.code).toBe('bad_request');
    expect(body.error.details[0].path).toBe('domain.domain_name');
  });

  it('reports an unknown domain as not found', async () => {
    const { status, body } = await api<{ error: { code: string } }>(
      server,
      '/v1/domains/00000000-0000-4000-8000-000000000000',
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });

  it('refuses requests from another origin', async () => {
    const { status, body } = await api<{ error: { code: string } }>(
      server,
      '/v1/domains',
      { headers: { Origin: 'https://evil.example' } },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });

  it('never leaks a raw driver error', async () => {
    const { body } = await api<{ error?: { message: string } }>(
      server,
      '/v1/assets/counts?type=not-a-table',
    );
    expect(JSON.stringify(body)).not.toMatch(/SQLITE|syntax error|no such table/i);
  });

  it('deletes a domain', async () => {
    expect(
      (await api(server, `/v1/domains/${domainId}`, { method: 'DELETE' })).status,
    ).toBe(200);
    expect((await api(server, '/v1/domains')).body).toEqual([]);
  });
});

describe.skipIf(!built)('/v1 API with a password set', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer({ DL_AUTH_PASSWORD: 'hunter2', DL_API_KEY: 'cron' });
  }, 60_000);

  afterAll(() => server?.stop());

  it('advertises that a password is required', async () => {
    expect((await api(server, '/v1/auth/status')).body).toEqual({
      authRequired: true,
      authenticated: false,
    });
  });

  it('refuses anonymous access', async () => {
    const { status, body } = await api<{ error: { code: string } }>(
      server,
      '/v1/domains',
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
  });

  it('refuses the wrong password', async () => {
    const { status } = await api(server, '/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'nope' }),
    });
    expect(status).toBe(401);
  });

  it('accepts the right password and issues a working session', async () => {
    const login = await fetch(`${server.url}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: server.url },
      body: JSON.stringify({ password: 'hunter2' }),
    });
    expect(login.status).toBe(200);

    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect(cookie).toMatch(/^dl_session=/);

    const { status } = await api(server, '/v1/domains', { headers: { Cookie: cookie } });
    expect(status).toBe(200);
  });

  it('rejects a forged session cookie', async () => {
    const { status } = await api(server, '/v1/domains', {
      headers: { Cookie: `dl_session=${Date.now() + 100000}.abc.forged` },
    });
    expect(status).toBe(401);
  });

  it('accepts the api key, so schedulers can still call in', async () => {
    const { status } = await api(server, '/v1/domains/count', {
      headers: { 'x-api-key': 'cron' },
    });
    expect(status).toBe(200);
  });
});

describe.skipIf(!built)('/v1 API in read-only mode', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer({ DL_DISABLE_WRITE_METHODS: 'true' });
  }, 60_000);

  afterAll(() => server?.stop());

  it('still serves reads', async () => {
    expect((await api(server, '/v1/domains')).status).toBe(200);
  });

  it('blocks writes on the server, not just in the UI', async () => {
    const { status, body } = await api<{ error: { code: string } }>(
      server,
      '/v1/domains',
      {
        method: 'POST',
        body: JSON.stringify({ domain: { domain_name: 'blocked.com' } }),
      },
    );
    expect(status).toBe(405);
    expect(body.error.code).toBe('read_only');
  });
});
