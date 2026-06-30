import type { WhoisResult } from '../types';
import { parseDate } from '../dates';
import { parseStatusArray } from '../status';
import { fetchJson } from '../fetch-json';
import Logger from '../../logger';

const log = new Logger('whois');
const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
let rdapBootstrapCache: Record<string, string> | null = null;

/* Determine the url for an rdap lookup, based on the domains TLD */
const getRdapUrlForTld = async (tld: string): Promise<string | null> => {
  try {
    if (!rdapBootstrapCache) {
      const json = await fetchJson<{ services: [string[], string[]][] }>(
        RDAP_BOOTSTRAP_URL,
      );
      rdapBootstrapCache = {};
      for (const [tlds, urls] of json.services) {
        for (const name of tlds) {
          rdapBootstrapCache[name] = urls[0].replace(/\/$/, '');
        }
      }
    }
    return rdapBootstrapCache[tld] ?? null;
  } catch (err) {
    log.warn(`Failed to fetch RDAP bootstrap: ${(err as Error).message}`);
    return null;
  }
};

type VCardEntry = [string, Record<string, unknown>, string, string];

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, VCardEntry[]];
  publicIds?: { type: string; identifier: string }[];
  entities?: RdapEntity[];
}

interface RdapResponse {
  ldhName?: string;
  handle?: string;
  status?: string[];
  events?: { eventAction: string; eventDate: string }[];
  entities?: RdapEntity[];
  secureDNS?: { zoneSigned?: boolean };
}

export const tryRdapLookup = async (domain: string): Promise<WhoisResult | null> => {
  try {
    const tld = domain.split('.').pop();
    if (!tld) return null;

    const rdapBase = await getRdapUrlForTld(tld);
    if (!rdapBase) {
      log.warn(`No RDAP base found for TLD .${tld}`);
      return null;
    }

    const json = await fetchJson<RdapResponse>(`${rdapBase}/domain/${domain}`);

    const events = json.events || [];
    const getEvent = (action: string) =>
      events.find((e) => e.eventAction === action)?.eventDate || null;

    // Find registrar entity
    const registrarEntity = json.entities?.find((e) => e.roles?.includes('registrar'));
    const registrarName =
      registrarEntity?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] || undefined;
    const registrarIanaId =
      registrarEntity?.publicIds?.find((p) => p.type === 'IANA Registrar ID')
        ?.identifier || undefined;

    // Find abuse contact entity
    const abuseEntity = json.entities?.flatMap(
      (e) => e.entities?.filter((sub) => sub.roles?.includes('abuse')) || [],
    )?.[0];
    const abuseEmail =
      abuseEntity?.vcardArray?.[1]?.find((v) => v[0] === 'email')?.[3] || undefined;
    const abusePhone =
      abuseEntity?.vcardArray?.[1]
        ?.find((v) => v[0] === 'tel')?.[3]
        ?.replace('tel:', '') || undefined;

    log.success(`Got WHOIS data via RDAP for ${domain}`);
    return {
      domainName: json.ldhName || null,
      registrar: {
        name: registrarName,
        id: registrarIanaId,
        url: undefined,
        registryDomainId: json.handle || undefined,
      },
      dates: {
        creation_date: parseDate(getEvent('registration')),
        updated_date: parseDate(getEvent('last changed')),
        expiry_date: parseDate(getEvent('expiration')),
      },
      whois: {},
      abuse: {
        email: abuseEmail,
        phone: abusePhone,
      },
      status: parseStatusArray(json.status),
      dnssec: json.secureDNS?.zoneSigned ? 'signed' : null,
    };
  } catch (err) {
    log.warn(`RDAP failed for ${domain}: ${(err as Error).message}`);
    return null;
  }
};
