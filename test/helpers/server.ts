import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

const SERVER_ENTRY = 'dist/analog/server/index.mjs';

export const isBuilt = () => existsSync(SERVER_ENTRY);

export interface RunningServer {
  url: string;
  stop: () => Promise<void>;
  logs: () => string;
}

/** Asks the OS for a port nothing else is using */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/** Boots the built server on a free port with its own throwaway SQLite file */
export async function startServer(
  env: Record<string, string> = {},
): Promise<RunningServer> {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'dl-test-'));
  let output = '';

  const child: ChildProcess = spawn('node', [SERVER_ENTRY], {
    env: {
      ...process.env,
      DL_ENV_TYPE: 'selfHosted',
      DL_SQLITE_PATH: join(dataDir, 'test.db'),
      PORT: String(port),
      NITRO_PORT: String(port),
      // Never let a test pick up the developer's own database
      DL_PG_HOST: '',
      DL_PG_USER: '',
      DL_PG_PASSWORD: '',
      DL_PG_NAME: '',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));

  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  };

  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early:\n${output}`);
    }
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return { url, stop, logs: () => output };
    } catch {
      // Not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await stop();
  throw new Error(`Server did not start within 15s:\n${output}`);
}

export interface ApiResponse<T> {
  status: number;
  body: T;
}

/** Calls the API the way the browser does, with an Origin the server accepts */
export async function api<T = unknown>(
  server: RunningServer,
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(`${server.url}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: server.url,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    body: (text ? JSON.parse(text) : null) as T,
  };
}
