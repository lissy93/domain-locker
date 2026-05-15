import { getEnvVar } from './utils';

export async function sendWebhookNotification(
  message: string,
  title = 'Domain Locker',
  tags?: string[],
): Promise<void> {
  const base = getEnvVar('NOTIFY_WEBHOOK_BASE');
  const topic = getEnvVar('NOTIFY_WEBHOOK_TOPIC');
  const token = getEnvVar('NOTIFY_WEBHOOK_TOKEN', '');

  if (!base || !topic) {
    console.log('Webhook notification skipped (missing config)');
    return;
  }

  try {
    const res = await fetch(`${base.replace(/[/]$/, '')}/${topic}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-Title': title,
        'X-Tags': tags?.join(',') ?? '',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: message,
    });

    if (!res.ok) {
      throw new Error(`Failed with status ${res.status}`);
    }

    console.info(`📨 Webhook sent: ${title} - ${message}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Webhook failed: ${msg}`);
  }
}
