export interface FreshDomainInfo {
  dates?: { expiry_date?: string; creation_date?: string; updated_date?: string };
  registrar?: { name?: string; url?: string };
  status?: string[];
  ssl?: Record<string, unknown>;
  whois?: Record<string, string | null | undefined>;
  dns?: { txt?: string[]; ns?: string[]; mx?: string[] };
  host?: Record<string, unknown>;
}

// Shape returned by /api/domain-info, before DNS keys are normalised for the updater
type RawDomainInfo = Omit<FreshDomainInfo, 'dns'> & {
  dns?: {
    nameServers?: string[];
    mxRecords?: string[];
    txtRecords?: string[];
  };
};

const FETCH_DOMAIN_INFO_TIMEOUT_MS = 10000;

export async function fetchDomainInfo(
  endpoint: string,
  domain: string,
): Promise<FreshDomainInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_DOMAIN_INFO_TIMEOUT_MS);

  try {
    const res = await fetch(`${endpoint}?domain=${encodeURIComponent(domain)}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch domain info for "${domain}", HTTP ${res.status}`);
    }

    const json = (await res.json()) as { domainInfo?: RawDomainInfo };
    if (!json?.domainInfo) {
      throw new Error(`No domainInfo found in response for "${domain}"`);
    }

    // Map API DNS keys (nameServers/mxRecords/txtRecords) to the updater's ns/mx/txt
    const { dns, ...info } = json.domainInfo;
    if (!dns) return info;
    return {
      ...info,
      dns: { ns: dns.nameServers, mx: dns.mxRecords, txt: dns.txtRecords },
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${FETCH_DOMAIN_INFO_TIMEOUT_MS / 1000} seconds for "${domain}"`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
