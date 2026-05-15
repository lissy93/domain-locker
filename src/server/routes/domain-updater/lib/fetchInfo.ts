export interface FreshDomainInfo {
  dates?: { expiry_date?: string; creation_date?: string; updated_date?: string };
  registrar?: { name?: string; url?: string };
  status?: string[];
  ssl?: Record<string, unknown>;
  whois?: Record<string, string | null | undefined>;
  dns?: { dnssec?: boolean; txt?: string[]; ns?: string[]; mx?: string[] };
  host?: Record<string, unknown>;
}

export async function fetchDomainInfo(
  endpoint: string,
  domain: string,
): Promise<FreshDomainInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${endpoint}?domain=${encodeURIComponent(domain)}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch domain info for "${domain}", HTTP ${res.status}`);
    }

    const json = (await res.json()) as { domainInfo?: FreshDomainInfo };
    if (!json?.domainInfo) {
      throw new Error(`No domainInfo found in response for "${domain}"`);
    }

    return json.domainInfo;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after 5 seconds for "${domain}"`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
