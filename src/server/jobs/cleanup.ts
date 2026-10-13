import { repos } from '../db/repos';
import { runUptimeCleanup } from './monitor';
import { REMINDER_TYPE } from './reminders';
import { numberFromEnv } from '../utils/config';
import Logger from '../utils/logger';

const log = new Logger('cleanup-monitor-data');

// Longer counts as keep forever, since huge values push the cutoff past a valid date
const MAX_DAYS = 36_500;

/** Prunes only when the retention var is set, so data is kept forever by default */
async function pruneIfSet(
  envVar: string,
  label: string,
  prune: (days: number) => Promise<number>,
): Promise<number> {
  const days = numberFromEnv(envVar, 0, { max: MAX_DAYS });
  const removed = days ? await prune(days) : 0;
  if (removed) log.info(`Removed ${removed} ${label} older than ${days} days`);
  return removed;
}

/** Uptime upkeep, then any retention limits that are set, keeping expiry reminders */
export async function runCleanup() {
  const db = repos();
  const uptime = await runUptimeCleanup();
  const history = await pruneIfSet(
    'DL_HISTORY_RETENTION_DAYS',
    'history entries',
    (days) => db.history.prune(days),
  );
  const notifications = await pruneIfSet(
    'DL_NOTIFICATIONS_RETENTION_DAYS',
    'notifications',
    (days) => db.notifications.prune(days, REMINDER_TYPE),
  );

  if (history + notifications) {
    try {
      if (await db.admin.compact()) log.info('Compacted the SQLite database');
    } catch (err) {
      log.warn(`Could not compact the database: ${(err as Error)?.message ?? err}`);
    }
  }
  return { ...uptime, history, notifications };
}
