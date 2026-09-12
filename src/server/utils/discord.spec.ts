import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendDiscordNotification } from './discord';

const WEBHOOK = 'https://discord.com/api/webhooks/1/token';

describe('sendDiscordNotification', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['DISCORD_WEBHOOK_URL'];
  });

  it('does nothing when no webhook is configured', async () => {
    expect(await sendDiscordNotification('hello')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts the title and message as json', async () => {
    process.env['DISCORD_WEBHOOK_URL'] = WEBHOOK;

    expect(await sendDiscordNotification('example.com expires soon', 'Expiry')).toBe(
      true,
    );

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      content: '**Expiry**\nexample.com expires soon',
    });
  });

  it('returns false when discord rejects the message', async () => {
    process.env['DISCORD_WEBHOOK_URL'] = WEBHOOK;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    expect(await sendDiscordNotification('hello')).toBe(false);
  });
});
