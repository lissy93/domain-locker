import { repos } from '../db/repos';
import { checkDomain } from './uptime-check';
import { withConcurrency } from './runner';
import { numberFromEnv } from '../utils/config';
import Logger from '../utils/logger';

const log = new Logger('domain-monitor');

const CONCURRENCY = numberFromEnv('DL_MONITOR_CONCURRENCY', 10, { min: 1 });

const daysFromEnv = (name: string, fallback: number) => numberFromEnv(name, fallback);

export interface MonitorSummary {
  checked: number;
  up: number;
  down: number;
}

/** Records one uptime sample per domain */
export async function runMonitor(): Promise<MonitorSummary> {
  const db = repos();
  const domains = await db.domains.listForMonitoring();
  if (!domains.length) return { checked: 0, up: 0, down: 0 };

  const outcomes = await withConcurrency(domains, CONCURRENCY, async (domain) => {
    const check = await checkDomain(domain.domain_name);
    await db.uptime.record(domain.id, check);
    return check.is_up;
  });

  const summary = outcomes.reduce(
    (totals, outcome) => {
      if (outcome.status === 'rejected') {
        log.warn(`Uptime check failed: ${(outcome.reason as Error)?.message}`);
        return { ...totals, checked: totals.checked + 1, down: totals.down + 1 };
      }
      return {
        checked: totals.checked + 1,
        up: totals.up + (outcome.value ? 1 : 0),
        down: totals.down + (outcome.value ? 0 : 1),
      };
    },
    { checked: 0, up: 0, down: 0 },
  );

  log.info(`Checked ${summary.checked} domains: ${summary.up} up, ${summary.down} down`);
  return summary;
}

/**
 * Collapses old samples into daily averages, keeping long-run history readable
 * without holding every check. Retention is off unless a hard cap is configured
 */
export async function runUptimeCleanup(): Promise<{
  averages: number;
  removed: number;
  deleted: number;
}> {
  const db = repos();
  const retentionDays = daysFromEnv('DL_UPTIME_RETENTION_DAYS', 0);

  const { averages, removed } = await db.uptime.aggregate(
    daysFromEnv('DL_UPTIME_AGGREGATE_AFTER_DAYS', 7),
  );
  const deleted = retentionDays > 0 ? await db.uptime.prune(retentionDays) : 0;

  log.info(`Collapsed ${removed} uptime checks into ${averages} daily averages`);
  if (deleted) log.info(`Removed ${deleted} rows older than ${retentionDays} days`);
  return { averages, removed, deleted };
}
