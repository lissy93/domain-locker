import { repos, type Repos } from '../db/repos';
import { sendWebhookNotification } from '../utils/webhook';
import Logger from '../utils/logger';

const log = new Logger('notify');

export interface DomainNotification {
  domainId: string;
  domainName: string;
  changeType: string;
  message: string;
  title?: string;
}

/**
 * Single delivery path for every job: records the notification, then fans it
 * out to whichever channels the user has enabled.
 */
export async function notify(notification: DomainNotification): Promise<boolean> {
  const db = repos();

  if (!(await isEnabledForDomain(db, notification))) {
    log.debug(`${notification.changeType} not enabled for ${notification.domainName}`);
    return false;
  }

  await db.notifications.add(
    notification.domainId,
    notification.changeType,
    notification.message,
  );

  // Most self-hosted instances have no external channels set up
  if (!(await deliver(db, notification))) {
    log.debug(`No external channel took ${notification.changeType}`);
  }
  return true;
}

/** Preferences are per domain and matched by prefix, as the UI groups them */
async function isEnabledForDomain(
  db: Repos,
  notification: DomainNotification,
): Promise<boolean> {
  const preferences = await db.notifications.preferencesFor(notification.domainId);
  return preferences.some(
    (preference) =>
      preference.is_enabled &&
      notification.changeType.startsWith(preference.notification_type),
  );
}

/** Sends to every configured channel, reporting success if any of them worked */
async function deliver(db: Repos, notification: DomainNotification): Promise<boolean> {
  const title = notification.title ?? `Domain Locker: ${notification.domainName}`;
  const body = `[${notification.domainName}] ${notification.message}`;
  const channels = (await db.notifications.channels()) ?? {};

  const deliveries: Promise<boolean>[] = [
    sendWebhookNotification(body, title, [notification.changeType]),
  ];

  const email = channels['email'] as { enabled?: boolean; address?: string } | undefined;
  if (email?.enabled && email.address) {
    deliveries.push(sendEmail(email.address, title, body));
  }

  const results = await Promise.all(deliveries);
  return results.some(Boolean);
}

/** Email delivery needs a provider; self-hosted instances usually have none */
async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const apiKey = process.env['RESEND_KEY'];
  const sender = process.env['NOTIFY_EMAIL_SENDER'];
  if (!apiKey || !sender) {
    log.debug('Email notification skipped (no provider configured)');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: sender, to: [to], subject, text: body }),
    });
    if (!response.ok) throw new Error(`Provider responded ${response.status}`);
    return true;
  } catch (err) {
    log.error(`Email notification failed: ${(err as Error)?.message}`);
    return false;
  }
}
