import { afterEach, describe, expect, it } from 'vitest';
import type { H3Event } from 'h3';
import { isSameOrigin } from '~/server/utils/same-origin';

/** Minimal H3 event stand-in, since the guard only reads request headers */
function eventWith(headers: Record<string, string>): H3Event {
  return { node: { req: { headers } } } as unknown as H3Event;
}

describe('cross-site request guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows requests with no Origin, so internal jobs keep working', () => {
    expect(isSameOrigin(eventWith({ host: 'localhost:3000' }))).toBe(true);
  });

  it('allows the app talking to itself', () => {
    const event = eventWith({ host: 'localhost:3000', origin: 'http://localhost:3000' });
    expect(isSameOrigin(event)).toBe(true);
  });

  it('blocks a malicious page trying to drive the API', () => {
    const event = eventWith({ host: 'localhost:3000', origin: 'https://evil.example' });
    expect(isSameOrigin(event)).toBe(false);
  });

  it('blocks an origin that merely starts with the host', () => {
    const event = eventWith({
      host: 'localhost:3000',
      origin: 'http://localhost:3000.evil.example',
    });
    expect(isSameOrigin(event)).toBe(false);
  });

  it('honours the configured public origin behind a proxy', () => {
    process.env['DL_BASE_URL'] = 'https://domains.example.com';
    const event = eventWith({
      host: 'internal-app:3000',
      origin: 'https://domains.example.com',
    });
    expect(isSameOrigin(event)).toBe(true);
  });

  it('honours extra allowed origins', () => {
    process.env['DL_ALLOWED_ORIGINS'] = 'https://a.example, https://b.example';
    expect(
      isSameOrigin(eventWith({ host: 'app:3000', origin: 'https://b.example' })),
    ).toBe(true);
    expect(
      isSameOrigin(eventWith({ host: 'app:3000', origin: 'https://c.example' })),
    ).toBe(false);
  });
});
