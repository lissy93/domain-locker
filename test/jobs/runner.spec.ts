import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '~/server/db/schema';
import { BACKENDS, createMigratedDb } from '../helpers/backends';

/**
 * The lock is what lets the internal scheduler and a legacy updater container
 * both trigger a job without duplicating work.
 */
describe.each(BACKENDS)('job locking (%s)', (backend) => {
  let db: Kysely<Database>;
  let runJob: typeof import('~/server/jobs/runner').runJob;

  beforeAll(async () => {
    db = await createMigratedDb(backend, 'dl_test_jobs');
    // The runner talks to the shared connection, so point it at this database
    const client = await import('~/server/db/client');
    const ready = await import('~/server/db/ready');
    vi.spyOn(client, 'getDb').mockReturnValue(db);
    vi.spyOn(ready, 'ensureMigrated').mockResolvedValue(undefined);
    ({ runJob } = await import('~/server/jobs/runner'));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await db?.destroy();
  });

  beforeEach(() => db.deleteFrom('job_runs').execute());

  it('runs the work and records success', async () => {
    const outcome = await runJob('domain-monitor', async () => 'done');

    expect(outcome.ran).toBe(true);
    expect(outcome.result).toBe('done');
    const [row] = await db.selectFrom('job_runs').selectAll().execute();
    expect(row.status).toBe('success');
    expect(row.finished_at).not.toBeNull();
  });

  it('records a failure without throwing, so a trigger never 500s', async () => {
    const outcome = await runJob('domain-monitor', async () => {
      throw new Error('whois exploded');
    });

    expect(outcome.ran).toBe(true);
    expect(outcome.error).toBe('whois exploded');
    const [row] = await db.selectFrom('job_runs').selectAll().execute();
    expect(row.status).toBe('failed');
    expect(row.detail).toBe('whois exploded');
  });

  it('skips a second trigger while the first is still running', async () => {
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => (release = resolve));

    const first = runJob('domain-monitor', async () => {
      await blocked;
      return 'first';
    });
    // Give the first run time to take the lock
    await new Promise((resolve) => setTimeout(resolve, 50));

    const second = await runJob('domain-monitor', async () => 'second');
    expect(second.ran).toBe(false);
    expect(second.skipped).toBe('already running');

    release();
    expect((await first).result).toBe('first');
  });

  it('lets the next trigger run once the first has finished', async () => {
    await runJob('domain-monitor', async () => 'first');
    const second = await runJob('domain-monitor', async () => 'second');
    expect(second.ran).toBe(true);
    expect(second.result).toBe('second');
  });

  it('takes over a lock left behind by a crashed run', async () => {
    await db
      .insertInto('job_runs')
      .values({
        name: 'domain-monitor',
        started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        finished_at: null,
        status: 'running',
        detail: null,
      })
      .execute();

    const outcome = await runJob('domain-monitor', async () => 'recovered');
    expect(outcome.ran).toBe(true);
    expect(outcome.result).toBe('recovered');
  });

  it('locks each job separately', async () => {
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => (release = resolve));

    const monitor = runJob('domain-monitor', async () => {
      await blocked;
      return 'monitor';
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const reminders = await runJob('expiration-reminders', async () => 'reminders');
    expect(reminders.ran).toBe(true);

    release();
    await monitor;
  });
});
