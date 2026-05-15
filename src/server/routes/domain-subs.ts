/**
 * API endpoint for getting subdomains, along with associated data for a given hostname.
 * Expects use of my custom Cloudflare worker, but also supports fallback to Shodan.
 * TODO: If there is a way to do this by looking at dns zone transfer records, that would be optimal.
 */
import { defineEventHandler, getQuery } from 'h3';
import { verifyAuth } from '../utils/auth';
import Logger from '../utils/logger';

const log = new Logger('domain-subs');

interface Subdomain {
  subdomain: string;
  tags?: string[];
  type: string;
  ip: string;
  ports?: number[];
  asn: string;
  asn_name: string;
  asn_range: string;
  country?: string;
  country_code?: string;
  banners?: Record<string, unknown>;
}

interface ShodanEntry {
  value?: string;
  type?: string;
  subdomain?: string;
  tags?: string[];
  ports?: number[];
  asn?: string;
  asn_name?: string;
  asn_range?: string;
  country?: string;
  country_code?: string;
  banners?: Record<string, unknown>;
}

interface ShodanResponse {
  domain?: string;
  data?: ShodanEntry[];
}

interface DnsDumpIp {
  ip: string;
  asn?: string;
  asn_name?: string;
  asn_range?: string;
  country?: string;
  country_code?: string;
  banners?: {
    http?: {
      apps?: string[];
      ports?: number[];
    };
  } & Record<string, unknown>;
}

interface DnsDumpEntry {
  host?: string;
  ips?: DnsDumpIp[];
}

interface DnsDumpResponse {
  a?: DnsDumpEntry[];
}

interface ServiceResponse {
  subdomains?: Subdomain[];
  error?: string;
}

// API tokens from env vars if specified
const SHODAN_TOKEN = import.meta.env['SHODAN_TOKEN'] || '';
const DNS_DUMPSTER_TOKEN = import.meta.env['DNS_DUMPSTER_TOKEN'] || '';

// Service URLs
const SHODAN_URL = import.meta.env['DL_SHODAN_URL'];
const DNSDUMP_URL = import.meta.env['DL_DNSDUMP_URL'];

const preferredMethod = import.meta.env['DL_PREFERRED_SUBDOMAIN_PROVIDER'];

// Check if services are actually configured (needs either custom URL or token with actual value)
const isShodanConfigured = !!(
  SHODAN_URL ||
  (SHODAN_TOKEN && SHODAN_TOKEN.trim().length > 0)
);
const isDnsDumpConfigured = !!(
  DNSDUMP_URL ||
  (DNS_DUMPSTER_TOKEN && DNS_DUMPSTER_TOKEN.trim().length > 0)
);

// Use preferred method if valid, otherwise auto-detect based on what's configured
const METHOD: 'shod' | 'dnsdump' | 'both' | 'none' = (() => {
  // If preferred method is set, validate it's actually configured
  if (preferredMethod === 'shod' && isShodanConfigured) return 'shod';
  if (preferredMethod === 'dnsdump' && isDnsDumpConfigured) return 'dnsdump';
  if (preferredMethod === 'both' && isShodanConfigured && isDnsDumpConfigured)
    return 'both';
  if (preferredMethod) {
    // User chose preferred method, but either invalid or not configured
    log.error(
      `Skipping subdomain lookup. Either ${preferredMethod} wasn't right, or you forgot to configure it.`,
    );
    return 'none';
  }

  // Auto-detect based on what's configured
  if (isDnsDumpConfigured && isShodanConfigured) return 'both';
  if (isDnsDumpConfigured) return 'dnsdump';
  if (isShodanConfigured) return 'shod';

  // Nothing is configured
  log.warn('Skipping subdomain lookup, no services configured');
  return 'none';
})();

// Fetches subdomains from a given service URL
async function fetchSubdomains(url: string): Promise<ServiceResponse> {
  log.debug(`Fetching subdomains from ${url}`);
  if (!url || url.includes('undefined')) {
    log.error(
      'Unable to check for subdomains, this has not been configured on your instance yet',
    );
    return {
      error:
        'Skipping subdomains, service not configured - please check your environmental variables',
    };
  }

  const requestParams: { method?: string; headers?: Record<string, string> } = {};

  if (url.includes('dnsdump')) {
    if (!DNS_DUMPSTER_TOKEN) {
      log.error('DNSDumpster token is not configured');
      return { error: 'Service is not configured' };
    }
    requestParams.method = 'GET';
    requestParams.headers = { 'X-Api-Key': DNS_DUMPSTER_TOKEN };
  }

  try {
    const response = await fetch(url, requestParams);

    // Check if response is HTML (common when API key invalid or service unavailable)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const errorMsg = url.includes('shodan')
        ? 'Shodan returned HTML instead of JSON. Check your API key/token is valid.'
        : 'Service returned HTML instead of JSON. Check your API configuration.';
      log.error(errorMsg);
      return { error: errorMsg };
    }

    const data = (await response.json()) as { error?: string } & ShodanResponse &
      DnsDumpResponse;
    if (data.error) {
      log.error(`Error from ${url}: ${data.error}`);
      return { error: data.error };
    }
    if (url.includes('shodan')) {
      return { subdomains: parseShodanResponse(data) };
    } else {
      return { subdomains: parseDnsDumpResponse(data) };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('Unexpected token') && errorMsg.includes('<html>')) {
      log.error(
        `Service returned HTML instead of JSON. This usually means invalid API credentials or the service is unavailable.`,
      );
      return { error: 'Service returned invalid response. Check API credentials.' };
    }
    log.error(`Error fetching from ${url}: ${errorMsg}`);
    return { error: 'Failed to fetch data from service' };
  }
}

// Parses the response from Shodan into a common format
function parseShodanResponse(data: ShodanResponse): Subdomain[] {
  return (
    data.data
      ?.map((entry) => {
        if (!entry.value || !entry.type || !entry.subdomain) return null;
        return {
          subdomain: entry.subdomain || data.domain || '',
          tags: entry.tags,
          type: entry.type,
          ip: entry.value,
          ports: entry.ports,
          asn: entry.asn || '',
          asn_name: entry.asn_name || '',
          asn_range: entry.asn_range || '',
          country: entry.country || 'unknown',
          country_code: entry.country_code || '??',
          banners: entry.banners,
        };
      })
      .filter((s): s is Subdomain => s !== null) || []
  );
}

// Parses the response from DNSDumpster into a common format
function parseDnsDumpResponse(data: DnsDumpResponse): Subdomain[] {
  return (
    data.a
      ?.map((entry) => {
        const ipData = entry.ips?.[0];
        if (!ipData?.ip || !entry.host) return null;
        return {
          subdomain: entry.host,
          tags: ipData.banners?.http?.apps || [],
          type: 'A',
          ip: ipData.ip,
          ports: ipData.banners?.http?.ports,
          asn: ipData.asn || '',
          asn_name: ipData.asn_name || '',
          asn_range: ipData.asn_range || '',
          country: ipData.country,
          country_code: ipData.country_code,
          banners: ipData.banners,
        };
      })
      .filter((s): s is Subdomain => s !== null) || []
  );
}

// Merges and deduplicates responses from both services
async function mergeResponses(
  domain: string,
  shodUrl: string,
  dnsDumpUrl: string,
): Promise<Subdomain[]> {
  const [shodData, dnsData] = await Promise.all([
    fetchSubdomains(shodUrl),
    fetchSubdomains(dnsDumpUrl),
  ]);
  if (shodData.error && dnsData.error) {
    throw new Error('Both services failed');
  }
  const combined = [...(shodData.subdomains || []), ...(dnsData.subdomains || [])];

  // Deduplicate and strip full domain
  return combined.reduce((unique, sub) => {
    // Strip full domain if present
    const strippedSubdomain =
      sub.subdomain.replace(new RegExp(`\\.?${domain}$`), '') || '';

    // Find an existing entry with the same subdomain
    const existing = unique.find((u) => u.subdomain === strippedSubdomain);

    if (existing) {
      // Merge the data with the existing entry
      existing.tags = Array.from(
        new Set([...(existing.tags || []), ...(sub.tags || [])]),
      );
      existing.ports = Array.from(
        new Set([...(existing.ports || []), ...(sub.ports || [])]),
      );
      existing.banners = { ...existing.banners, ...sub.banners };
      existing.type = existing.type || sub.type; // Keep the first type
      existing.ip = existing.ip || sub.ip; // Prefer existing IP if available
    } else {
      // Add the new entry
      unique.push({ ...sub, subdomain: strippedSubdomain });
    }

    return unique;
  }, [] as Subdomain[]);
}

function removeDuplicates(subdomains: Subdomain[]): Subdomain[] {
  const uniqueMap = new Map<string, Subdomain>();

  subdomains.forEach((sub) => {
    if (!uniqueMap.has(sub.subdomain)) {
      uniqueMap.set(sub.subdomain, sub);
    }
  });

  return Array.from(uniqueMap.values());
}

export default defineEventHandler(async (event) => {
  const authResult = await verifyAuth(event);

  if (!authResult.success) {
    return { statusCode: 401, body: { error: authResult.error } };
  }

  const query = getQuery(event);
  const domain = ((query['domain'] as string) || '').replaceAll('www.', '').trim();

  if (!domain) {
    return { error: 'Domain name is required' };
  }

  // Check if subdomain fetching is configured
  if (METHOD === 'none') {
    return {
      error:
        'Subdomain fetching is not configured. Please configure at least one subdomain provider.',
    };
  }

  const shodanUrl = SHODAN_URL
    ? `${SHODAN_URL}/${domain}`
    : SHODAN_TOKEN
      ? `https://api.shodan.io/dns/domain/${domain}?key=${SHODAN_TOKEN}`
      : '';
  const dnsdumpUrl = DNSDUMP_URL
    ? `${DNSDUMP_URL}/${domain}`
    : DNS_DUMPSTER_TOKEN
      ? `https://api.dnsdumpster.com/domain/${domain}`
      : '';

  try {
    let subdomains: Subdomain[] = [];
    log.debug(`Fetching subdomains for ${domain} using method: ${METHOD}`);
    if (METHOD === 'both') {
      subdomains = await mergeResponses(domain, shodanUrl, dnsdumpUrl);
    } else {
      const primaryUrl = METHOD === 'shod' ? shodanUrl : dnsdumpUrl;

      // Determine if fallback is available and configured
      const hasFallback = METHOD === 'shod' ? isDnsDumpConfigured : isShodanConfigured;
      const fallbackUrl = hasFallback ? (METHOD === 'shod' ? dnsdumpUrl : shodanUrl) : '';

      log.debug(`Primary URL: ${primaryUrl}, Fallback available: ${hasFallback}`);

      const primaryData = await fetchSubdomains(primaryUrl);
      if (primaryData.error) {
        // Only try fallback if it's actually configured
        if (hasFallback && fallbackUrl) {
          log.debug(`Primary service failed, trying fallback`);
          const fallbackData = await fetchSubdomains(fallbackUrl);
          if (fallbackData.error) {
            throw new Error(`Both primary (${METHOD}) and fallback services failed`);
          }
          subdomains = fallbackData.subdomains || [];
        } else {
          throw new Error(
            `Primary service (${METHOD}) failed and no fallback configured`,
          );
        }
      } else {
        subdomains = primaryData.subdomains || [];
      }
    }

    return removeDuplicates(subdomains);
  } catch (error) {
    log.error(`Error fetching subdomains for ${domain}: ${error}`);
    return { error: 'Failed to retrieve subdomains' };
  }
});

// i'm a dinosaur. raaawwwr.
