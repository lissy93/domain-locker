import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { stopProcess } from './server';

/**
 * A dev server teardown that waits forever fails the suite on the hook timeout
 * rather than on anything real, so the wait has to stay bounded
 */
describe('stopProcess', () => {
  it('returns once a well behaved process exits', async () => {
    const child = spawn('node', ['-e', 'setInterval(() => {}, 1000)']);
    await expect(stopProcess(child)).resolves.toBeUndefined();
    expect(child.exitCode ?? child.signalCode).not.toBeNull();
  });

  it('kills a process that ignores SIGTERM rather than waiting on it', async () => {
    const child = spawn('node', [
      '-e',
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); console.log('ready')",
    ]);
    // Signalling before the handler is installed would kill it the ordinary way
    await new Promise((resolve) => child.stdout?.once('data', resolve));
    const startedAt = Date.now();

    await stopProcess(child, 300);

    expect(child.signalCode).toBe('SIGKILL');
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });

  it('returns immediately when the process has already gone', async () => {
    const child = spawn('node', ['-e', '']);
    await new Promise((resolve) => child.once('exit', resolve));

    await expect(stopProcess(child)).resolves.toBeUndefined();
  });
});
