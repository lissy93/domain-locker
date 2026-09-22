import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, isBuilt, startServer, type RunningServer } from '../helpers/server';

const built = isBuilt();

/** Polls the captured output, since the server listens before setup finishes */
async function waitForLog(server: RunningServer, text: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.logs().includes(text)) return server.logs();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return server.logs();
}

/** Becos self-hosted container ships no companion cron anymore */
describe.skipIf(!built)('server startup', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer({ NODE_ENV: 'production' });
  }, 60_000);

  afterAll(() => server?.stop());

  it('sets the database up and starts the scheduler, with no first visitor', async () => {
    const logs = await waitForLog(server, 'Scheduled cleanup-monitor-data');

    expect(logs).toContain('[migrations]');
    for (const job of ['domain-monitor', 'domain-updater', 'expiration-reminders']) {
      expect(logs).toContain(`Scheduled ${job}`);
    }
  });

  it('reports the database state in the healthcheck', async () => {
    await waitForLog(server, 'Scheduled cleanup-monitor-data');
    const { status, body } = await api<{ status: string; database: string }>(
      server,
      '/api/health',
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', database: 'ready' });
  });
});
