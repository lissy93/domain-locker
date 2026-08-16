import { callPgExecutor } from './pgExecutor';
import { sendWebhookNotification } from '../../../utils/webhook';
import Logger from '../../../utils/logger';

const log = new Logger('domain-updater');

/**
 * Check if a notification should be sent for a changeType, and insert it if so.
 */
export async function notifyUser(
  pgExec: string,
  domainId: string,
  userId: string,
  changeType: string,
  message?: string,
): Promise<void> {
  try {
    const prefs = await callPgExecutor<{ notification_type: string }>(
      pgExec,
      `SELECT notification_type FROM notification_preferences WHERE domain_id = $1 AND is_enabled = true`,
      [domainId],
    );

    if (!prefs || prefs.length === 0) return;

    const enabledTypes = prefs.map((p) => p.notification_type);

    const isEnabled = enabledTypes.some((prefix: string) =>
      changeType.startsWith(prefix),
    );

    if (!isEnabled) {
      log.info(
        `Skipping notification for ${changeType}, because not enabled for this domain`,
      );
      return;
    }

    // Get domain name from domain ID, to include in notification
    const domainResult = await callPgExecutor<{ domain_name: string }>(
      pgExec,
      `SELECT domain_name FROM domains WHERE id = $1`,
      [domainId],
    );
    const domainName = domainResult?.[0]?.domain_name ?? 'unknown domain';

    // Insert notification
    await callPgExecutor(
      pgExec,
      `
      INSERT INTO notifications (user_id, domain_id, change_type, message)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, domainId, changeType, message || null],
    );

    // Send webhook notification
    await sendWebhookNotification(
      message
        ? `[${domainName}] ${message}`
        : `Change detected in ${domainName}: ${changeType}`,
      'Domain Locker Update',
      [changeType],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Failed to insert notification for ${changeType}: ${msg}`);
  }
}
