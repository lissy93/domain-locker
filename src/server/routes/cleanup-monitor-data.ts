import { defineEventHandler } from 'h3';
import { getBaseUrl } from '../utils/base-url';

const RETENTION_DAYS = 7;

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

export default defineEventHandler(async (event) => {
  if (getEnvVar('DL_ENV_TYPE') !== 'selfHosted') {
    return { error: 'Only available in self-hosted mode' };
  }

  const baseUrl = getBaseUrl(event);
  const pgUrl = `${baseUrl}/api/pg-executer`;
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const domains = await callPgExecutor<{ domain_id: string; domain_name: string }>(
    pgUrl,
    `SELECT DISTINCT u.domain_id, d.domain_name
     FROM uptime u
     JOIN domains d ON u.domain_id = d.id
     WHERE u.checked_at < $1`,
    [cutoff],
  );

  if (!domains.length) {
    return { message: 'No data to aggregate', domainsAggregated: 0 };
  }

  let totalAggregated = 0;
  const details: string[] = [];

  for (const { domain_id, domain_name } of domains) {
    try {
      const result = await callPgExecutor<{ aggregated: number; deleted: number }>(
        pgUrl,
        `WITH daily_stats AS (
          SELECT
            date_trunc('day', checked_at)::date as day,
            avg(case when is_up then 1.0 else 0.0 end) > 0.5 as is_up,
            round(avg(response_time_ms)) as response_time_ms,
            round(avg(dns_lookup_time_ms)) as dns_time_ms,
            round(avg(ssl_handshake_time_ms)) as ssl_time_ms
          FROM uptime
          WHERE domain_id = $1 AND checked_at < $2
          GROUP BY day
        ),
        inserted AS (
          INSERT INTO uptime (domain_id, checked_at, is_up, response_code, response_time_ms, dns_lookup_time_ms, ssl_handshake_time_ms)
          SELECT $1, day + interval '12 hours', is_up, 200, response_time_ms, dns_time_ms, ssl_time_ms
          FROM daily_stats
          ON CONFLICT DO NOTHING
          RETURNING checked_at
        ),
        deleted AS (
          DELETE FROM uptime
          WHERE domain_id = $1 AND checked_at < $2
            AND checked_at NOT IN (SELECT checked_at FROM inserted)
          RETURNING id
        )
        SELECT
          (SELECT count(*)::int FROM inserted) as aggregated,
          (SELECT count(*)::int FROM deleted) as deleted`,
        [domain_id, cutoff],
      );

      const { aggregated = 0, deleted = 0 } = result[0] || {};
      totalAggregated += aggregated;
      details.push(`${domain_name}: ${aggregated} days, ${deleted} deleted`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      details.push(`${domain_name}: FAILED - ${msg}`);
    }
  }

  return {
    domainsAggregated: domains.length,
    totalDays: totalAggregated,
    details,
  };
});
