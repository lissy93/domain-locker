import { repos } from '../db/repos';
import { notify } from './notify';
import Logger from '../utils/logger';

const log = new Logger('expiration-reminders');

const DAY_MS = 86_400_000;
const DEFAULT_THRESHOLDS = [90, 30, 7, 2, 0];

/** Matches the preference key the settings page writes */
const REMINDER_TYPE = 'expiry_domain';

export interface ReminderResult {
  domain: string;
  expires_in: number;
  notification_sent: boolean;
}

export function reminderThresholds(): number[] {
  const parsed = (process.env['DL_EXPIRATION_REMINDER_DAYS'] || '')
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return parsed.length ? parsed.sort((a, b) => b - a) : DEFAULT_THRESHOLDS;
}

/** The threshold just passed, or null. Windowed so a missed run still sends */
export function matchedThreshold(
  daysRemaining: number,
  thresholds: number[],
  windowDays = 2,
): number | null {
  if (daysRemaining < 0) return null;
  return (
    thresholds.find(
      (threshold) => daysRemaining <= threshold && daysRemaining > threshold - windowDays,
    ) ?? null
  );
}

export function crossedThreshold(
  daysRemaining: number,
  thresholds: number[],
  windowDays = 2,
): boolean {
  return matchedThreshold(daysRemaining, thresholds, windowDays) !== null;
}

export function daysUntil(expiryDate: string, today = new Date()): number {
  const expiry = new Date(`${expiryDate.slice(0, 10)}T00:00:00Z`);
  const start = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((expiry.getTime() - start.getTime()) / DAY_MS);
}

export async function runReminders(): Promise<ReminderResult[]> {
  const db = repos();
  const thresholds = reminderThresholds();
  const domains = await db.domains.listExpiring();
  const results: ReminderResult[] = [];

  for (const domain of domains) {
    const expiresIn = daysUntil(domain.expiry_date);
    const threshold = matchedThreshold(expiresIn, thresholds);
    const sent =
      threshold === null
        ? false
        : await remind(domain.id, domain.domain_name, expiresIn, threshold);
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

/** Start of the UTC day the domain crossed this threshold */
export function thresholdCrossedAt(
  expiresIn: number,
  threshold: number,
  now = Date.now(),
): string {
  const crossed = new Date(now - (threshold - expiresIn) * DAY_MS);
  return `${crossed.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

/** One reminder per threshold */
async function remind(
  domainId: string,
  domainName: string,
  expiresIn: number,
  threshold: number,
): Promise<boolean> {
  const since = thresholdCrossedAt(expiresIn, threshold);
  if (await repos().notifications.sentSince(domainId, REMINDER_TYPE, since)) {
    return false;
  }

  const days = `${expiresIn} day${expiresIn === 1 ? '' : 's'}`;
  return notify({
    domainId,
    domainName,
    changeType: REMINDER_TYPE,
    message: expiresIn === 0 ? 'Expires today' : `Expires in ${days}`,
    title:
      expiresIn === 0
        ? `${domainName} expires today`
        : `${domainName} expires in ${days}`,
  });
}
