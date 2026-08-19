import { createError, defineEventHandler } from 'h3';
import { getInternalBaseUrl } from '../utils/base-url';
import { sendWebhookNotification } from '../utils/webhook';
import Logger from '../utils/logger';

const log = new Logger('expiration-reminders');

interface ExpiringDomain {
  id: string;
  domain_name: string;
  expiry_date: string;
  user_id: string;
}

export default defineEventHandler(async (event) => {
  const { DL_ENV_TYPE, DL_EXPIRATION_REMINDER_DAYS } = process.env;

  if (DL_ENV_TYPE !== 'selfHosted') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Disabled in managed environment',
    });
  }

  const rawThresholds = DL_EXPIRATION_REMINDER_DAYS || '90,30,7,2';
  const defaultThresholds = [90, 30, 7, 2];

  const parsed = rawThresholds
    .split(',')
    .map((value: string) => parseInt(value.trim(), 10))
    .filter((value: number) => Number.isFinite(value) && value > 0);
  const thresholds = parsed.length ? parsed : defaultThresholds;

  const baseUrl = getInternalBaseUrl(event);
  const pgExecUrl = `${baseUrl}/api/pg-executer`;
  const today = new Date().toISOString().split('T')[0];

  let domains: ExpiringDomain[] = [];
  try {
    const res = await fetch(pgExecUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
        SELECT id, domain_name, expiry_date, user_id
        FROM domains
        WHERE expiry_date IS NOT NULL
      `,
      }),
    });
    if (!res.ok) {
      throw new Error(`pg-executer responded ${res.status}`);
    }
    domains = (await res.json()).data ?? [];
  } catch (err) {
    log.error(`Failed to fetch domains: ${(err as Error)?.message}`);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch domains for expiration reminders',
    });
  }

  const results = [];

  for (const d of domains) {
    const days = Math.ceil(
      (new Date(d.expiry_date).getTime() - new Date(today).getTime()) / 86400000,
    );
    if (!thresholds.includes(days)) {
      results.push({
        domain: d.domain_name,
        expires_in: days,
        notification_sent: false,
      });
      continue;
    }

    const msg = `⚠️ Domain ${d.domain_name} expires in ${days} days`;
    const title = `Domain expires in ${days} days`;

    try {
      const inserted = await fetch(pgExecUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            INSERT INTO notifications (user_id, domain_id, change_type, message, sent, created_at)
            VALUES ($1, $2, 'reminder', $3, true, NOW())
          `,
          params: [d.user_id, d.id, msg],
        }),
      });
      if (!inserted.ok) {
        throw new Error(`pg-executer responded ${inserted.status}`);
      }
    } catch (err) {
      log.error(
        `Failed to insert reminder for ${d.domain_name}: ${(err as Error)?.message}`,
      );
      continue;
    }

    const notification_sent = await sendWebhookNotification(msg, title);

    results.push({
      domain: d.domain_name,
      expires_in: days,
      notification_sent,
    });
  }

  return results;
});
