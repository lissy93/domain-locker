import whois from 'whois-json';
import Logger from '../logger';
import type { WhoisResult } from './types';
import { hasUsefulWhoisData } from './normalize';
import { timeLeft } from './fetch-json';
import { normalizeWhoisJson, type RawWhois } from './providers/whois-json';
import { tryWhoDat } from './providers/who-dat';
import { tryNativeWhois } from './providers/native-whois';
import { tryRdapLookup } from './providers/rdap';
import { tryWhoisXml } from './providers/whoisxml';

const log = new Logger('whois');

type Provider = (domain: string, deadline: number) => Promise<WhoisResult | null>;

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

/** Total time across every source, so one stalled registry can't starve the fallbacks */
const WHOIS_BUDGET_MS = 20000;

/** Order is overridable, so an instance can prefer its own source */
function providerOrder(): string[] {
  const configured = (process.env['DL_WHOIS_PROVIDERS'] || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name in PROVIDERS);
  return configured.length ? configured : DEFAULT_ORDER;
}

export const getWhoisInfo = async (
  domain: string,
  budgetMs = WHOIS_BUDGET_MS,
): Promise<WhoisResult | null> => {
  const trimmed = domain
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .trim()
    .toLowerCase();
  const deadline = Date.now() + budgetMs;

  for (const name of providerOrder()) {
    if (Date.now() >= deadline) {
      log.warn(`WHOIS budget spent before trying ${name} for ${trimmed}`);
      break;
    }
    try {
      const result = await PROVIDERS[name](trimmed, deadline);
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

/** Keeps the registry's answer when the registrar server it refers on to is down */
const lookupPort43 = (domain: string, timeout: number): Promise<RawWhois> =>
  whois(domain, { timeout }).catch(() =>
    whois(domain, { timeout, follow: 0 }),
  ) as Promise<RawWhois>;

/** Port-43 WHOIS, raced against the deadline since the library's timeout is per hop */
async function tryWhoisJson(
  domain: string,
  deadline: number,
): Promise<WhoisResult | null> {
  const timeoutMs = timeLeft(deadline);
  const raw = await Promise.race([
    lookupPort43(domain, timeoutMs),
    new Promise<RawWhois>((_, reject) =>
      setTimeout(
        () => reject(new Error(`WHOIS timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);

  if (!raw || typeof raw !== 'object' || !Object.keys(raw).length || raw.error) {
    return null;
  }
  return normalizeWhoisJson(raw);
}
