import { basicAuth, splitUrlCredentials } from './basic-auth';
import Logger, { errorMessage } from './logger';

const log = new Logger('webhook');

/** Token wins over explicit credentials, which win over any embedded in the base URL */
function resolveAuthHeader(urlAuth: string | null): string | null {
  const token = process.env['NOTIFY_WEBHOOK_TOKEN']?.trim();
  if (token) return `Bearer ${token}`;

  const username = process.env['NOTIFY_WEBHOOK_USERNAME'] ?? '';
  const password = process.env['NOTIFY_WEBHOOK_PASSWORD'] ?? '';
  if (username || password) return basicAuth(`${username}:${password}`);

  return urlAuth;
}

/** Build the topic endpoint and auth header, defaulting the base to https */
function resolveTarget(base: string, topic: string): { url: URL; auth: string | null } {
  const withScheme = /^https?:\/\//.test(base) ? base : `https://${base}`;
  const { url, auth } = splitUrlCredentials(withScheme);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${topic}`;
  return { url, auth: resolveAuthHeader(auth) };
}

/** Send a push notification to the configured ntfy-compatible webhook */
export async function sendWebhookNotification(
  message: string,
  title = 'Domain Locker',
  tags?: string[],
): Promise<boolean> {
  const base = process.env['NOTIFY_WEBHOOK_BASE']?.trim();
  const topic = process.env['NOTIFY_WEBHOOK_TOPIC']?.trim();
  if (!base || !topic) {
    log.info('Webhook notification skipped (missing config)');
    return false;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    'X-Title': title,
  };
  if (tags?.length) headers['X-Tags'] = tags.join(',');

  try {
    const { url, auth } = resolveTarget(base, topic);
    if (auth) headers['Authorization'] = auth;
    const res = await fetch(url, { method: 'POST', headers, body: message });
    if (!res.ok) {
      throw new Error(`Failed with status ${res.status}`);
    }
    log.info(`Webhook sent: ${title} - ${message}`);
    return true;
  } catch (err) {
    log.error(`Webhook failed: ${errorMessage(err)}`);
    return false;
  }
}
