import Logger from './logger';

const log = new Logger('apprise');

const TIMEOUT_MS = 30_000;

/** Send a notification through the configured Apprise API server */
export async function sendAppriseNotification(
  message: string,
  title = 'Domain Locker',
): Promise<boolean> {
  const base = process.env['APPRISE_API_URL']?.trim().replace(/\/+$/, '');
  const key = process.env['APPRISE_KEY']?.trim();
  const urls = process.env['APPRISE_URLS']?.trim();
  if (!base || !(key || urls)) {
    log.info('Apprise notification skipped (missing config)');
    return false;
  }

  // A stored config key is notified when set, otherwise the urls are sent stateless
  const url = key ? `${base}/notify/${key}` : `${base}/notify`;
  const tag = process.env['APPRISE_TAG']?.trim() || undefined;
  const payload = { title, body: message, ...(key ? { tag } : { urls }) };

  try {
    const endpoint = new URL(url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Credentials in the URL go in a basic auth header, as fetch rejects them inline
    if (endpoint.username || endpoint.password) {
      const credentials = decodeURIComponent(`${endpoint.username}:${endpoint.password}`);
      headers['Authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
      endpoint.username = '';
      endpoint.password = '';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Apprise answers 204 when the key or urls gave it nothing to notify
    if (res.status === 204) {
      throw new Error('Nothing to notify, check APPRISE_KEY or APPRISE_URLS');
    }
    if (!res.ok) {
      throw new Error(`Failed with status ${res.status}`);
    }
    log.info(`Apprise sent: ${title} - ${message}`);
    return true;
  } catch (err) {
    log.error(`Apprise failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
