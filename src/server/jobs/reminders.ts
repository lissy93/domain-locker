import { currentBackend, getDb } from '../db/client';
import { createRepos } from '../db/repos';
import { notify } from './notify';
import Logger from '../utils/logger';

const log = new Logger('expiration-reminders');

const DEFAULT_THRESHOLDS = [90, 30, 7, 2];

export interface ReminderResult {
  domain: string;
  expires_in: number;
  notification_sent: boolean;
}

export function reminderThresholds(): number[] {
  const parsed = (process.env['DL_EXPIRATION_REMINDER_DAYS'] || '')
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return parsed.length ? parsed.sort((a, b) => b - a) : DEFAULT_THRESHOLDS;
}

/**
 * True when the domain has just crossed a threshold. Windowed rather than an
 * exact-day match, so a job that misses a run still sends the reminder.
 */
export function crossedThreshold(
  daysRemaining: number,
  thresholds: number[],
  windowDays = 1,
): boolean {
  if (daysRemaining < 0) return false;
  return thresholds.some(
    (threshold) =>
      daysRemaining <= threshold && daysRemaining > threshold - windowDays - 1,
  );
}

export function daysUntil(expiryDate: string, today = new Date()): number {
  const expiry = new Date(`${expiryDate.slice(0, 10)}T00:00:00Z`);
  const start = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((expiry.getTime() - start.getTime()) / 86_400_000);
}

export async function runReminders(): Promise<ReminderResult[]> {
  const repos = createRepos(getDb(), currentBackend());
  const thresholds = reminderThresholds();
  const domains = await repos.domains.list();
  const results: ReminderResult[] = [];

  for (const domain of domains) {
    if (!domain.expiry_date) continue;
    const expiresIn = daysUntil(domain.expiry_date);

    if (!crossedThreshold(expiresIn, thresholds)) {
      results.push({
        domain: domain.domain_name,
        expires_in: expiresIn,
        notification_sent: false,
      });
      continue;
    }

    const sent = await notify({
      domainId: domain.id,
      domainName: domain.domain_name,
      changeType: 'reminder',
      message: `Expires in ${expiresIn} day${expiresIn === 1 ? '' : 's'}`,
      title: `${domain.domain_name} expires in ${expiresIn} days`,
    });

    results.push({
      domain: domain.domain_name,
      expires_in: expiresIn,
      notification_sent: sent,
    });
  }

  const sentCount = results.filter((result) => result.notification_sent).length;
  log.info(`Checked ${results.length} domains, sent ${sentCount} reminders`);
  return results;
}
