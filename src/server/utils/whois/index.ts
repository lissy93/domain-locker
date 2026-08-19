import whois from 'whois-json';
import Logger from '../logger';
import type { WhoisResult } from './types';
import { hasUsefulWhoisData } from './normalize';
import { FETCH_TIMEOUT_MS } from './fetch-json';
import { normalizeWhoisJson, type RawWhois } from './providers/whois-json';
import { tryWhoDat } from './providers/who-dat';
import { tryNativeWhois } from './providers/native-whois';
import { tryRdapLookup } from './providers/rdap';
import { tryWhoisXml } from './providers/whoisxml';

const log = new Logger('whois');

type Provider = (domain: string) => Promise<WhoisResult | null>;

/**
 * RDAP first: it is structured, resolves its endpoint per TLD from the IANA
 * bootstrap, and is far less prone to the rate limiting and parse failures
 * that port-43 WHOIS suffers from. The rest are fallbacks, in order.
 */
const PROVIDERS: Record<string, Provider> = {
  rdap: tryRdapLookup,
  'whois-json': tryWhoisJson,
  'who-dat': tryWhoDat,
  native: tryNativeWhois,
  whoisxml: tryWhoisXml,
};

const DEFAULT_ORDER = ['rdap', 'whois-json', 'who-dat', 'native', 'whoisxml'];

/** Order is overridable, so an instance can prefer its own source */
function providerOrder(): string[] {
  const configured = (process.env['DL_WHOIS_PROVIDERS'] || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name in PROVIDERS);
  return configured.length ? configured : DEFAULT_ORDER;
}

export const getWhoisInfo = async (domain: string): Promise<WhoisResult | null> => {
  const trimmed = domain
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .trim()
    .toLowerCase();

  for (const name of providerOrder()) {
    try {
      const result = await PROVIDERS[name](trimmed);
      if (hasUsefulWhoisData(result)) {
        log.success(`Got WHOIS data via ${name} for ${trimmed}`);
        return result;
      }
      log.debug(`${name} returned no useful data for ${trimmed}`);
    } catch (err) {
      log.warn(`${name} failed for ${trimmed}: ${(err as Error).message}`);
    }
  }

  log.warn(`No WHOIS provider returned data for ${trimmed}`);
  return null;
};

/** Port-43 WHOIS, wrapped with a timeout because the library has none */
async function tryWhoisJson(domain: string): Promise<WhoisResult | null> {
  const raw = await Promise.race([
    whois(domain) as Promise<RawWhois>,
    new Promise<RawWhois>((_, reject) =>
      setTimeout(
        () => reject(new Error(`WHOIS timeout after ${FETCH_TIMEOUT_MS}ms`)),
        FETCH_TIMEOUT_MS,
      ),
    ),
  ]);

  if (!raw || typeof raw !== 'object' || !Object.keys(raw).length || raw.error) {
    return null;
  }
  return normalizeWhoisJson(raw);
}
