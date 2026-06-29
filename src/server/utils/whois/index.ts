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

export const getWhoisInfo = async (domain: string): Promise<WhoisResult | null> => {
  const trimmed = domain
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .trim()
    .toLowerCase();

  // Each fallback source returns useful data or null, tried in order until one sticks
  const fallback = async (): Promise<WhoisResult | null> => {
    for (const provider of [tryWhoDat, tryNativeWhois, tryRdapLookup, tryWhoisXml]) {
      const result = await provider(trimmed);
      if (hasUsefulWhoisData(result)) return result;
    }
    return null;
  };

  try {
    const raw = await Promise.race([
      whois(trimmed) as Promise<RawWhois>,
      new Promise<RawWhois>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`WHOIS timeout after ${FETCH_TIMEOUT_MS}ms for ${domain}`)),
          FETCH_TIMEOUT_MS,
        ),
      ),
    ]);
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0 && !raw.error) {
      const normalized = normalizeWhoisJson(raw);
      if (hasUsefulWhoisData(normalized)) {
        log.success(`Got WHOIS data via whois-json for ${domain}`);
        return normalized;
      }
      log.warn(`whois-json returned incomplete data for ${domain}, falling back`);
      return await fallback();
    }
    log.warn(`whois-json returned empty or error for ${domain}, falling back`);
    return await fallback();
  } catch (err) {
    log.error(`whois-json failed for ${domain}: ${(err as Error).message}`);
    return await fallback();
  }
};
