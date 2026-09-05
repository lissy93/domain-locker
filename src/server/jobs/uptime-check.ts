import { lookup } from 'node:dns/promises';
import { connect, type TLSSocket } from 'node:tls';
import { request } from 'node:https';
import { performance } from 'node:perf_hooks';
import { numberFromEnv } from '../utils/config';

export interface UptimeCheck {
  is_up: boolean;
  response_code: number | null;
  response_time_ms: number | null;
  dns_lookup_time_ms: number | null;
  ssl_handshake_time_ms: number | null;
}

const TIMEOUT_MS = numberFromEnv('DL_MONITOR_TIMEOUT', 10_000, { min: 1 });

/** Times each stage separately, so a slow DNS or TLS step is visible on its own */
export async function checkDomain(domainName: string): Promise<UptimeCheck> {
  const dns = await time(() => lookup(domainName));
  if (!dns.ok) {
    return {
      is_up: false,
      response_code: null,
      response_time_ms: null,
      dns_lookup_time_ms: dns.ms,
      ssl_handshake_time_ms: null,
    };
  }

  const tls = await time(() => handshake(domainName));
  const http = await time(() => head(domainName));

  return {
    is_up: http.ok && (http.value ?? 0) < 400,
    response_code: http.value ?? null,
    response_time_ms: http.ms,
    dns_lookup_time_ms: dns.ms,
    ssl_handshake_time_ms: tls.ok ? tls.ms : null,
  };
}

async function time<T>(
  work: () => Promise<T>,
): Promise<{ ok: boolean; ms: number; value?: T }> {
  const startedAt = performance.now();
  try {
    const value = await work();
    return { ok: true, ms: Math.round(performance.now() - startedAt), value };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - startedAt) };
  }
}

function handshake(domainName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (err: Error) => {
      socket.destroy();
      reject(err);
    };
    const socket: TLSSocket = connect(
      { host: domainName, port: 443, servername: domainName, timeout: TIMEOUT_MS },
      () => {
        socket.end();
        resolve();
      },
    );
    socket.on('error', fail);
    socket.on('timeout', () => fail(new Error('TLS handshake timed out')));
  });
}

function head(domainName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: domainName, path: '/', method: 'HEAD', timeout: TIMEOUT_MS },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}
