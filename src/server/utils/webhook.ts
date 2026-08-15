import Logger from './logger';

const log = new Logger('webhook');

// Leading `user:pass@` in a URL, which fetch rejects and so must be moved to a header
const URL_CREDENTIALS = /^(https?:\/\/)([^/@]*)@/;

/** Token wins over explicit credentials, which win over any embedded in the base URL */
function resolveAuthHeader(urlCredentials: string): string | null {
  const token = process.env['NOTIFY_WEBHOOK_TOKEN']?.trim();
  if (token) return `Bearer ${token}`;

  let username = process.env['NOTIFY_WEBHOOK_USERNAME'] ?? '';
  let password = process.env['NOTIFY_WEBHOOK_PASSWORD'] ?? '';

  if (!username && !password && urlCredentials) {
    const [user, ...rest] = urlCredentials.split(':');
    username = user;
    password = rest.join(':');
  }

  if (!username && !password) return null;
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

/** Build the topic endpoint and auth header from env, or null when unconfigured */
function resolveTarget(): { url: string; auth: string | null } | null {
  const base = process.env['NOTIFY_WEBHOOK_BASE']?.trim();
  const topic = process.env['NOTIFY_WEBHOOK_TOPIC']?.trim();
  if (!base || !topic) return null;

  const withScheme = /^https?:\/\//.test(base) ? base : `https://${base}`;
  const urlCredentials = withScheme.match(URL_CREDENTIALS)?.[2] ?? '';
  const url = withScheme.replace(URL_CREDENTIALS, '$1').replace(/\/$/, '');

  return { url: `${url}/${topic}`, auth: resolveAuthHeader(urlCredentials) };
}

/** Send a push notification to the configured ntfy-compatible webhook */
export async function sendWebhookNotification(
  message: string,
  title = 'Domain Locker',
  tags?: string[],
): Promise<boolean> {
  const target = resolveTarget();
  if (!target) {
    log.info('Webhook notification skipped (missing config)');
    return false;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    'X-Title': title,
  };
  if (tags?.length) headers['X-Tags'] = tags.join(',');
  if (target.auth) headers['Authorization'] = target.auth;

  try {
    const res = await fetch(target.url, { method: 'POST', headers, body: message });
    if (!res.ok) {
      throw new Error(`Failed with status ${res.status}`);
    }
    log.info(`Webhook sent: ${title} - ${message}`);
    return true;
  } catch (err) {
    log.error(`Webhook failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
