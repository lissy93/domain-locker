import { defineEventHandler } from 'h3';
import { getBaseUrl } from '../utils/base-url';

export default defineEventHandler(async (event) => {
  const {
    DL_ENV_TYPE,
    NOTIFY_WEBHOOK_BASE,
    NOTIFY_WEBHOOK_TOPIC,
    DL_EXPIRATION_REMINDER_DAYS,
  } = process.env;

  if (DL_ENV_TYPE !== 'selfHosted') {
    return new Response('Disabled in managed environment', { status: 403 });
  }

  const rawThresholds = DL_EXPIRATION_REMINDER_DAYS || '90,30,7,2';
  const defaultThresholds = [90, 30, 7, 2];

  let thresholds: number[] = [];
  try {
    thresholds = rawThresholds
      .split(',')
      .map((v: string) => parseInt(v.trim(), 10))
      .filter((v: number) => Number.isFinite(v) && v > 0);
    if (thresholds.length === 0) {
      thresholds = defaultThresholds;
    }
  } catch (err) {
    console.error(
      'Invalid DL_EXPIRATION_REMINDER_DAYS format, returning to default',
      err,
    );
    thresholds = defaultThresholds;
  }

  const DL_BASE_URL = getBaseUrl(event);
  const pgExecUrl = `${DL_BASE_URL}/api/pg-executer`;
  const today = new Date().toISOString().split('T')[0];

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
  }).catch((err) => {
    console.error('Failed to fetch domains:', err);
    return new Response('Failed to fetch domains', { status: 500 });
  });

  const { data: domains = [] } = await res.json();

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

    let notification_sent = false;
    const msg = `⚠️ Domain ${d.domain_name} expires in ${days} days`;
    const title = `Domain expires in ${days} days`;

    try {
      await fetch(pgExecUrl, {
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
    } catch (e) {
      console.error('Failed to insert notification:', e);
      continue;
    }

    if (NOTIFY_WEBHOOK_BASE && NOTIFY_WEBHOOK_TOPIC) {
      try {
        await $fetch(`${NOTIFY_WEBHOOK_BASE}/${NOTIFY_WEBHOOK_TOPIC}`, {
          method: 'POST',
          headers: { 'X-Title': title },
          body: msg,
        });
        notification_sent = true;
      } catch (e) {
        console.error('Failed to call webhook:', e);
      }
    }

    results.push({
      domain: d.domain_name,
      expires_in: days,
      notification_sent,
    });
  }

  return results;
});
