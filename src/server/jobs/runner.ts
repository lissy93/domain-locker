import { getDb } from '../db/client';
import { ensureMigrated } from '../db/ready';
import Logger from '../utils/logger';

const log = new Logger('jobs');

/** A job left running this long is assumed dead, and its lock can be taken */
const STALE_LOCK_MS = 30 * 60 * 1000;

export type JobName =
  | 'domain-updater'
  | 'domain-monitor'
  | 'expiration-reminders'
  | 'cleanup-monitor-data';

export interface JobOutcome<T = unknown> {
  job: JobName;
  ran: boolean;
  skipped?: string;
  result?: T;
  error?: string;
  durationMs?: number;
}

/**
 * Runs a job under a database lock, so the internal scheduler and a legacy
 * updater container triggering the old routes never duplicate work.
 */
export async function runJob<T>(
  job: JobName,
  work: () => Promise<T>,
): Promise<JobOutcome<T>> {
  await ensureMigrated();
  if (!(await acquireLock(job))) {
    log.info(`${job} is already running, skipping this trigger`);
    return { job, ran: false, skipped: 'already running' };
  }

  const startedAt = Date.now();
  try {
    const result = await work();
    await releaseLock(job, 'success');
    const durationMs = Date.now() - startedAt;
    log.success(`${job} finished in ${durationMs}ms`);
    return { job, ran: true, result, durationMs };
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    await releaseLock(job, 'failed', message);
    log.error(`${job} failed: ${message}`);
    return { job, ran: true, error: message, durationMs: Date.now() - startedAt };
  }
}

async function acquireLock(job: JobName): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  await db
    .insertInto('job_runs')
    .values({ name: job, started_at: null, finished_at: now, status: 'idle' })
    .onConflict((conflict) => conflict.column('name').doNothing())
    .execute();

  const result = await db
    .updateTable('job_runs')
    .set({ started_at: now, finished_at: null, status: 'running', detail: null })
    .where('name', '=', job)
    .where((eb) =>
      eb.or([eb('finished_at', 'is not', null), eb('started_at', '<', staleBefore)]),
    )
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0) > 0;
}

async function releaseLock(job: JobName, status: string, detail?: string): Promise<void> {
  await getDb()
    .updateTable('job_runs')
    .set({ finished_at: new Date().toISOString(), status, detail: detail ?? null })
    .where('name', '=', job)
    .execute();
}

export async function jobHistory() {
  await ensureMigrated();
  return getDb().selectFrom('job_runs').selectAll().orderBy('name').execute();
}

/** Runs work over items with a bounded number in flight at once */
export async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () =>
    (async () => {
      while (next < items.length) {
        const index = next++;
        try {
          results[index] = { status: 'fulfilled', value: await work(items[index]) };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

/** Retries transient failures, backing off between attempts (WHOIS rate limits) */
export async function withRetry<T>(
  work: () => Promise<T>,
  { attempts = 3, baseDelayMs = 1000 } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await work();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await delay(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
