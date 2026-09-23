import { afterEach, describe, expect, it, vi } from 'vitest';
import whois from 'whois-json';
import { getWhoisInfo } from '~/server/utils/whois';
import { tryRdapLookup } from '~/server/utils/whois/providers/rdap';

vi.mock('whois-json', () => ({ default: vi.fn() }));

const BOOTSTRAP = { services: [[['com'], ['https://rdap.example/']]] };
const WHO_DAT_RECORD = {
  domain: 'example.com',
  isRegistered: true,
  registrar: { name: 'Who-dat Registrar' },
  dates: { expires: '2030-01-01T00:00:00Z' },
};

type Reply = { status: number; body?: unknown } | 'stall';

/** Answers by URL prefix, where a stalled registry only ever ends when the request is aborted */
function fakeFetch(replies: Record<string, Reply>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const reply = Object.entries(replies).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!reply) throw new Error(`Unexpected request to ${url}`);
    if (reply === 'stall') {
      return new Promise<never>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    }
    return {
      ok: reply.status < 300,
      status: reply.status,
      statusText: '',
      json: async () => reply.body,
    };
  });
}

describe('whois lookup chain', () => {
  afterEach(() => {
    vi.mocked(whois).mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('falls through to the next source when one has nothing', async () => {
    const fetchMock = fakeFetch({
      'https://data.iana.org': { status: 200, body: BOOTSTRAP },
      'https://rdap.example': { status: 404 },
      'https://who-dat.as93.net': { status: 200, body: WHO_DAT_RECORD },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('DL_WHOIS_PROVIDERS', 'rdap,who-dat');

    const result = await getWhoisInfo('example.com');

    expect(result?.registrar.name).toBe('Who-dat Registrar');
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain('https://rdap.example/domain/example.com');
  });

  it('cuts a stalled source off at the deadline rather than its own timeout', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({
        'https://data.iana.org': { status: 200, body: BOOTSTRAP },
        'https://rdap.example': 'stall',
      }),
    );
    const start = Date.now();

    const result = await tryRdapLookup('example.com', Date.now() + 200);

    expect(result).toBeNull();
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('gives the whole chain one budget, however many sources stall', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({
        'https://data.iana.org': { status: 200, body: BOOTSTRAP },
        'https://rdap.example': 'stall',
        'https://who-dat.as93.net': 'stall',
      }),
    );
    vi.stubEnv('DL_WHOIS_PROVIDERS', 'rdap,who-dat');
    const start = Date.now();

    const result = await getWhoisInfo('example.com', 200);

    expect(result).toBeNull();
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('bounds the port-43 library, which has no deadline of its own, the same way', async () => {
    vi.mocked(whois).mockReturnValue(new Promise<never>(() => undefined));
    vi.stubGlobal('fetch', fakeFetch({ 'https://who-dat.as93.net': 'stall' }));
    vi.stubEnv('DL_WHOIS_PROVIDERS', 'whois-json,who-dat');
    const start = Date.now();

    const result = await getWhoisInfo('example.com', 200);

    expect(result).toBeNull();
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('keeps the registry answer when the registrar server it refers to is down', async () => {
    vi.mocked(whois)
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({
        registrar: 'Porkbun LLC',
        registryDomainId: '333e0d17-DONUTS',
      });
    vi.stubEnv('DL_WHOIS_PROVIDERS', 'whois-json');

    const result = await getWhoisInfo('hs1.bz');

    expect(result?.registrar).toMatchObject({
      name: 'Porkbun LLC',
      registryDomainId: '333e0d17-DONUTS',
    });
    expect(whois).toHaveBeenLastCalledWith(
      'hs1.bz',
      expect.objectContaining({ follow: 0 }),
    );
  });
});
