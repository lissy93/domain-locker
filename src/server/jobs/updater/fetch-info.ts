import { isValidDomain, lookupDomainInfo } from '../../utils/domain-info';
import { withTimeout } from './utils';

export interface FreshDomainInfo {
  dates?: { expiry_date?: string; creation_date?: string; updated_date?: string };
  registrar?: { name?: string; url?: string };
  status?: string[];
  ssl?: Record<string, unknown>;
  whois?: Record<string, string | null | undefined>;
  dns?: { txt?: string[]; ns?: string[]; mx?: string[] };
  host?: Record<string, unknown>;
}

const LOOKUP_TIMEOUT_MS = 10000;

/**
 * Resolves a domain in-process. Going over HTTP would mean the job guessing the
 * port it is served on, which it cannot know when no request triggered the run
 */
export async function fetchDomainInfo(domain: string): Promise<FreshDomainInfo> {
  if (!isValidDomain(domain)) {
    throw new Error(`Invalid domain name "${domain}"`);
  }

  const { domainInfo } = await withTimeout(lookupDomainInfo(domain), LOOKUP_TIMEOUT_MS);

  return {
    dates: domainInfo.dates,
    registrar: domainInfo.registrar,
    status: domainInfo.status,
    ssl: { ...domainInfo.ssl },
    whois: { ...domainInfo.whois },
    host: domainInfo.host ? { ...domainInfo.host } : undefined,
    // The updater's field names are shorter than the lookup's
    dns: {
      ns: domainInfo.dns.nameServers,
      mx: domainInfo.dns.mxRecords,
      txt: domainInfo.dns.txtRecords,
    },
  };
}
