import { defineEventHandler } from 'h3';
import { getEnvVar, withTimeout } from './lib/utils';
import { callPgExecutor } from './lib/pgExecutor';
import { fetchDomainInfo } from './lib/fetchInfo';
import { compareAndUpdateDomain } from './lib/compare';
import { getInternalBaseUrl } from '../../utils/base-url';

const DOMAIN_FETCH_TIMEOUT = 10000; // ms
const DOMAIN_UPDATE_TIMEOUT = 7000; // ms
const CONCURRENCY_LIMIT = 5;

export interface DomainRow {
  id: string;
  domain_name: string;
  expiry_date?: string;
  registration_date?: string;
  updated_date?: string;
  registrar?: { name?: string; url?: string } | null;
  user_id?: string;
  host?: Record<string, unknown> | null;
}

type WorkerResult<R> = R | { domain: string; error: string };

async function runWithConcurrency<T, R>(
  items: T[],
  workerFn: (item: T) => Promise<R>,
  limit = CONCURRENCY_LIMIT,
): Promise<WorkerResult<R>[]> {
  const results: WorkerResult<R>[] = [];
  const queue = [...items];

  const workers = new Array(limit).fill(null).map(async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) continue;
      try {
        const result = await workerFn(item);
        results.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const name = (item as { domain_name?: string })?.domain_name ?? 'unknown';
        results.push({ domain: name, error: msg });
      }
    }
  });

  await Promise.all(workers);
  return results;
}

export default defineEventHandler(async (event) => {
  if (getEnvVar('DL_ENV_TYPE') !== 'selfHosted') {
    return { error: 'Only available in self-hosted mode.' };
  }

  const baseUrl = getInternalBaseUrl(event);
  const pgExecUrl = `${baseUrl}/api/pg-executer`;
  const domainInfoUrl = `${baseUrl}/api/domain-info`;

  let domains: DomainRow[] = [];

  try {
    domains = await withTimeout(
      callPgExecutor<DomainRow>(
        pgExecUrl,
        `
        SELECT d.id, d.domain_name, d.expiry_date, d.registration_date, d.updated_date, d.user_id,
               jsonb_build_object('name', r.name, 'url', r.url) as registrar,
               (
                 SELECT jsonb_build_object(
                   'ip', h.ip, 'lat', h.lat::text, 'lon', h.lon::text,
                   'isp', h.isp, 'org', h.org, 'as_number', h.as_number,
                   'city', h.city, 'region', h.region, 'country', h.country
                 )
                 FROM domain_hosts dh
                 JOIN hosts h ON h.id = dh.host_id
                 WHERE dh.domain_id = d.id
                 ORDER BY dh.updated_at DESC
                 LIMIT 1
               ) as host
        FROM domains d
        LEFT JOIN registrars r ON d.registrar_id = r.id
        ORDER BY d.domain_name
      `,
      ),
      DOMAIN_FETCH_TIMEOUT,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Failed to fetch domains: ${msg}` };
  }

  if (!domains.length) {
    return { message: 'No domains found to update.' };
  }

  const results = await runWithConcurrency(domains, async (row) => {
    try {
      const fresh = await withTimeout(
        fetchDomainInfo(domainInfoUrl, row.domain_name),
        DOMAIN_FETCH_TIMEOUT,
      );
      const { domain, changes } = await withTimeout(
        compareAndUpdateDomain(pgExecUrl, row, fresh),
        DOMAIN_UPDATE_TIMEOUT,
      );

      return changes.length > 0
        ? {
            domain,
            changes,
            note: `✅ ${changes.length} changes were found and saved for ${domain}`,
          }
        : {
            domain,
            changes: [],
            note: `ℹ️ No changes for ${domain}, all data is up-to-date`,
          };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { domain: row.domain_name, error: msg };
    }
  });

  return {
    results,
    note: '📝 Domain updates complete!',
  };
});
