import { currentBackend, getDb } from '../db/client';
import { createRepos } from '../db/repos';
import { checkDomain } from './uptime-check';
import { withConcurrency } from './runner';
import Logger from '../utils/logger';

const log = new Logger('domain-monitor');

const CONCURRENCY = Number(process.env['DL_MONITOR_CONCURRENCY'] || 10);
const RETENTION_DAYS = Number(process.env['DL_UPTIME_RETENTION_DAYS'] || 90);

export interface MonitorSummary {
  checked: number;
  up: number;
  down: number;
}

/** Records one uptime sample per domain */
export async function runMonitor(): Promise<MonitorSummary> {
  const repos = createRepos(getDb(), currentBackend());
  const domains = await repos.domains.list();
  if (!domains.length) return { checked: 0, up: 0, down: 0 };

  const outcomes = await withConcurrency(domains, CONCURRENCY, async (domain) => {
    const check = await checkDomain(domain.domain_name);
    await repos.uptime.record(domain.id, check);
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

/** Drops uptime samples past the retention window */
export async function runUptimeCleanup(): Promise<{ deleted: number }> {
  const repos = createRepos(getDb(), currentBackend());
  const deleted = await repos.uptime.prune(RETENTION_DAYS);
  log.info(`Removed ${deleted} uptime rows older than ${RETENTION_DAYS} days`);
  return { deleted };
}
