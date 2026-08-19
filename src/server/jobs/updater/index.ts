import { currentBackend, getDb } from '../../db/client';
import { createRepos } from '../../db/repos';
import { getInternalBaseUrl } from '../../utils/base-url';
import { fetchDomainInfo } from './fetch-info';
import { compareAndUpdateDomain } from './compare';
import { withConcurrency, withRetry } from '../runner';
import Logger from '../../utils/logger';

const log = new Logger('domain-updater');

const CONCURRENCY = Number(process.env['DL_UPDATER_CONCURRENCY'] || 5);
/** Cap per run so a large portfolio spreads over several runs instead of stalling */
const BATCH_SIZE = Number(process.env['DL_UPDATER_BATCH_SIZE'] || 100);

export interface DomainRow {
  id: string;
  domain_name: string;
  expiry_date?: string;
  registration_date?: string;
  updated_date?: string;
  registrar?: { name?: string; url?: string | null } | null;
  user_id?: string;
  host?: Record<string, unknown> | null;
}

export interface UpdaterResult {
  domain: string;
  changes?: string[];
  error?: string;
}

export async function runUpdater(): Promise<{
  checked: number;
  changed: number;
  results: UpdaterResult[];
}> {
  const repos = createRepos(getDb(), currentBackend());
  const domains = await repos.domains.list();
  if (!domains.length) {
    return { checked: 0, changed: 0, results: [] };
  }

  // Least recently updated first, so every domain gets its turn
  const batch = domains
    .slice()
    .sort((left, right) =>
      (left.updated_date ?? '').localeCompare(right.updated_date ?? ''),
    )
    .slice(0, BATCH_SIZE);

  const domainInfoUrl = `${getInternalBaseUrl()}/api/domain-info`;

  const outcomes = await withConcurrency(batch, CONCURRENCY, async (domain) => {
    try {
      // Lookups are rate limited upstream, so back off rather than give up
      const fresh = await withRetry(() =>
        fetchDomainInfo(domainInfoUrl, domain.domain_name),
      );
      const { changes } = await compareAndUpdateDomain(
        {
          id: domain.id,
          domain_name: domain.domain_name,
          expiry_date: domain.expiry_date ?? undefined,
          registration_date: domain.registration_date ?? undefined,
          updated_date: domain.updated_date ?? undefined,
          user_id: domain.user_id ?? undefined,
          registrar: domain.registrar,
          host: domain.host,
        },
        fresh,
      );
      return { domain: domain.domain_name, changes } satisfies UpdaterResult;
    } catch (err) {
      return {
        domain: domain.domain_name,
        error: (err as Error)?.message ?? String(err),
      } satisfies UpdaterResult;
    }
  });

  const results = outcomes.map((outcome) =>
    outcome.status === 'fulfilled'
      ? outcome.value
      : { domain: 'unknown', error: String(outcome.reason) },
  );
  const changed = results.filter((result) => result.changes?.length).length;

  log.info(`Checked ${results.length} of ${domains.length} domains, ${changed} changed`);
  return { checked: results.length, changed, results };
}
