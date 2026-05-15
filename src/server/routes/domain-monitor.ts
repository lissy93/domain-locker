import { defineEventHandler } from 'h3';
import https from 'https';
import { performance } from 'perf_hooks';
import { getBaseUrl } from '../utils/base-url';

const HTTP_TIMEOUT_MS = 10000;
const MAX_EXECUTION_TIME_MS = 12 * 60 * 1000;
const CONCURRENCY_LIMIT = parseInt(process.env['DL_MONITOR_CONCURRENCY'] || '10', 10);

function getEnvVar(name: string, fallback?: string): string {
  const val = process.env[name] || (import.meta.env && import.meta.env[name]);
  return val || fallback || '';
}

async function callPgExecutor<T>(
  endpoint: string,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, params }),
  });
  const data = await res.json();
  return data.data || [];
}

async function checkDomainUptime(domainName: string): Promise<{
  is_up: boolean;
  response_code: number;
  response_time_ms: number;
}> {
  const startTime = performance.now();

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: domainName,
        path: '/',
        method: 'HEAD',
        timeout: HTTP_TIMEOUT_MS,
        agent: false,
      },
      (res) => {
        res.resume();
        resolve({
          is_up: (res.statusCode || 0) < 400,
          response_code: res.statusCode || 0,
          response_time_ms: Math.round(performance.now() - startTime),
        });
      },
    );

    req.on('error', () =>
      resolve({
        is_up: false,
        response_code: 0,
        response_time_ms: Math.round(performance.now() - startTime),
      }),
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ is_up: false, response_code: 0, response_time_ms: HTTP_TIMEOUT_MS });
    });

    req.end();
  });
}

async function processBatch<T, R>(
  items: T[],
  workerFn: (item: T) => Promise<R>,
  batchSize: number,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(workerFn));
    results.push(
      ...batchResults
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<R>).value),
    );
  }
  return results;
}

export default defineEventHandler(async (event) => {
  if (getEnvVar('DL_ENV_TYPE') !== 'selfHosted') {
    return { error: 'Only available in self-hosted mode' };
  }

  const startTime = Date.now();
  const baseUrl = getBaseUrl(event);
  const pgUrl = `${baseUrl}/api/pg-executer`;

  const domains = await callPgExecutor<{ id: string; domain_name: string }>(
    pgUrl,
    'SELECT id, domain_name FROM domains ORDER BY domain_name',
  );

  if (!domains.length) {
    return { message: 'No domains to check' };
  }

  const results = await processBatch(
    domains,
    async (d) => {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        return { domain: d.domain_name, status: 'skipped' };
      }

      const uptime = await checkDomainUptime(d.domain_name);

      await callPgExecutor(
        pgUrl,
        `INSERT INTO uptime (domain_id, is_up, response_code, response_time_ms, dns_lookup_time_ms, ssl_handshake_time_ms)
       VALUES ($1::uuid, $2, $3, $4, 0, 0)`,
        [d.id, uptime.is_up, uptime.response_code, uptime.response_time_ms],
      );

      return {
        domain: d.domain_name,
        status: uptime.is_up ? `✅ up (${uptime.response_code})` : '❌ down',
        is_up: uptime.is_up,
      };
    },
    CONCURRENCY_LIMIT,
  );

  return {
    totalDomains: domains.length,
    checked: results.length,
    results,
    executionTimeMs: Date.now() - startTime,
  };
});
