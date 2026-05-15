import whois from 'whois-json';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Dates, Registrar, Contact, Abuse } from '../../types/common';
import Logger from './logger';

const execAsync = promisify(exec);

const log = new Logger('whois');
const WHOISXML_API_KEY = process.env['WHOISXML_API_KEY'];
const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

// Parse WHOIS date to ISO format, handling DD/MM/YYYY for international domains
const parseDate = (date: string | null | undefined): string | undefined => {
  if (!date) return undefined;
  // Remove timezone suffixes and clean
  const cleaned = date
    .trim()
    .replace(/\s+[A-Z]+$/, '')
    .trim();

  // Already ISO format or similar (YYYY-MM-DD with optional time) - return date part only
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(cleaned)) {
    return cleaned.split(/[T\s]/)[0];
  }

  // DD/MM/YYYY or DD.MM.YYYY format (day > 12 = definitely day-first)
  const match = cleaned.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (match) {
    const [, a, b, year] = match.map(Number);
    const day = a > 12 ? a : b > 12 ? b : a;
    const month = a > 12 ? b : b > 12 ? a : b;
    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  // Try standard JS parsing for other formats
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split('T')[0];
};

interface WhoisResult {
  domainName: string | null;
  status: string[];
  dnssec: string | null;
  dates: Partial<Dates>;
  registrar: Partial<Registrar>;
  whois: Partial<Contact>;
  abuse: Partial<Abuse>;
}

type RawWhois = Record<string, unknown> & {
  error?: unknown;
  registrar?: string | { name?: string } | null;
  registrarName?: string;
  dates?: Record<string, string | undefined>;
};

let rdapBootstrapCache: Record<string, string> | null = null;

export const getWhoisInfo = async (domain: string): Promise<WhoisResult | null> => {
  const trimmed = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').trim();

  const fallback = async (): Promise<WhoisResult | null> => {
    const native = await tryNativeWhois(trimmed);
    if (
      native &&
      native.domainName &&
      (native.dates.expiry_date || native.registrar.name !== 'Unknown')
    ) {
      return native;
    }

    const rdap = await tryRdapLookup(trimmed);
    if (rdap && (rdap.dates.expiry_date || rdap.registrar.name)) {
      return rdap;
    }

    if (WHOISXML_API_KEY) {
      const xml = await tryWhoisXml(trimmed);
      if (xml) return xml;
    }

    return null;
  };

  try {
    const WHOIS_TIMEOUT_MS = 8000;
    const raw = await Promise.race([
      whois(trimmed) as Promise<RawWhois>,
      new Promise<RawWhois>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`WHOIS timeout after ${WHOIS_TIMEOUT_MS}ms for ${domain}`)),
          WHOIS_TIMEOUT_MS,
        ),
      ),
    ]);
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0 && !raw.error) {
      const normalized = normalizeWhoisJson(raw);
      // Check if we got useful data (dates or registrar info)
      if (normalized.dates.expiry_date || normalized.registrar.name !== 'Unknown') {
        log.success(`Got WHOIS data via whois-json for ${domain}`);
        return normalized;
      }
      log.warn(
        `whois-json returned incomplete data for ${domain} (no dates/registrar), falling back`,
      );
      return await fallback();
    }
    log.warn(`whois-json returned empty or error for ${domain}, falling back`);
    return await fallback();
  } catch (err) {
    log.error(`whois-json failed for ${domain}: ${(err as Error).message}`);
    return await fallback();
  }
};

/* Converts mystery random whois structure into WhoisResult */
const normalizeWhoisJson = (raw: RawWhois): WhoisResult => {
  const str = (key: string): string | undefined => {
    const v = raw[key];
    return typeof v === 'string' ? v : undefined;
  };
  const registrarObj =
    typeof raw.registrar === 'object' && raw.registrar ? raw.registrar : undefined;
  const registrarName =
    str('registrarName') ||
    (typeof raw.registrar === 'string' ? raw.registrar : registrarObj?.name) ||
    'Unknown';
  return {
    domainName: str('domainName') || null,
    registrar: {
      name: registrarName,
      id: str('registrarIanaId'),
      url: str('registrarUrl'),
      registryDomainId: str('registryDomainId'),
    },
    dates: {
      creation_date: parseDate(
        str('creationDate') ||
          str('createdDate') ||
          str('created') ||
          str('domainRegistrationDate') ||
          str('registered') ||
          str('registrationDate') ||
          (raw.dates && (raw.dates['creation_date'] || raw.dates['created'])),
      ),
      updated_date: parseDate(
        str('updatedDate') ||
          str('lastUpdated') ||
          str('updated') ||
          str('domainLastUpdated') ||
          str('lastModified') ||
          str('modified') ||
          (raw.dates && (raw.dates['updated_date'] || raw.dates['updated'])),
      ),
      expiry_date: parseDate(
        str('expiryDate') ||
          str('registrarRegistrationExpirationDate') ||
          str('expiresDate') ||
          str('expirationDate') ||
          str('domainExpirationDate') ||
          str('expiry') ||
          str('expires') ||
          str('expire') ||
          str('paidUntil') ||
          str('paid_until') ||
          (raw.dates && (raw.dates['expiry_date'] || raw.dates['expires'])),
      ),
    },
    whois: {
      name: str('registrantName'),
      organization: str('registrantOrganization'),
      street: str('registrantStreet'),
      city: str('registrantCity'),
      country: str('registrantCountry'),
      state: str('registrantStateProvince'),
      postal_code: str('registrantPostalCode'),
    },
    abuse: {
      email: str('abuseContactEmail') || str('registrarAbuseContactEmail'),
      phone: str('abuseContactPhone') || str('registrarAbuseContactPhone'),
    },
    status: parseStatusArray(str('domainStatus') || str('status')),
    dnssec: str('dnssec') || null,
  };
};

/* Statuses come back as long string with urls, convert to array of IDs */
const parseStatusArray = (status?: string): string[] => {
  if (!status) return [];

  const knownStatuses = [
    'clientDeleteProhibited',
    'clientHold',
    'clientRenewProhibited',
    'clientTransferProhibited',
    'clientUpdateProhibited',
    'serverDeleteProhibited',
    'serverHold',
    'serverRenewProhibited',
    'serverTransferProhibited',
    'serverUpdateProhibited',
    'inactive',
    'ok',
    'pendingCreate',
    'pendingDelete',
    'pendingRenew',
    'pendingRestore',
    'pendingTransfer',
    'pendingUpdate',
    'addPeriod',
    'autoRenewPeriod',
    'renewPeriod',
    'transferPeriod',
  ];
  // Convert to lowercase, just for the comparison
  const normalized = status.toLowerCase();
  // Match anything resembling a known status
  const matches = knownStatuses.filter((s) => normalized.includes(s.toLowerCase()));
  // Deduplicate + preserve ICANN casing
  return Array.from(new Set(matches));
};

/* Determine the url for an rdp lookup, based on the domains TLD */
const getRdapUrlForTld = async (tld: string): Promise<string | null> => {
  try {
    if (!rdapBootstrapCache) {
      const res = await fetch(RDAP_BOOTSTRAP_URL);
      if (!res.ok) throw new Error(`Failed to fetch IANA RDAP data`);
      const json = (await res.json()) as { services: [string[], string[]][] };

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

/* Try native whois command as a fallback when libraries fail */
const tryNativeWhois = async (domain: string): Promise<WhoisResult | null> => {
  // Skip native whois on serverless environments where system packages aren't available
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    return null;
  }

  try {
    // Sanitize domain input to prevent command injection
    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
    if (!sanitizedDomain || sanitizedDomain !== domain) {
      log.warn(`Invalid domain format for native whois: ${domain}`);
      return null;
    }

    const { stdout } = await execAsync(`whois ${sanitizedDomain}`, { timeout: 10000 });

    if (!stdout || stdout.length < 50) {
      log.warn(
        `Native whois returned insufficient data for ${domain}: ${stdout?.length || 0} bytes`,
      );
      return null;
    }

    // Parse key-value pairs from whois output
    const lines = stdout.split(/\r?\n/); // Handle both \n and \r\n line endings
    const data: Record<string, string> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const match = trimmedLine.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1]
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/\//g, '_');
        const value = match[2].trim();
        if (value && !value.startsWith('REDACTED')) {
          data[key] = value;
        }
      }
    }

    const result = {
      domainName: data.domain_name || null,
      registrar: {
        name: data.registrar || 'Unknown',
        id: data.registrar_iana_id || null,
        url: data.registrar_url || data.registrar_whois_server || null,
        registryDomainId: data.registry_domain_id || null,
      },
      dates: {
        creation_date: parseDate(
          data.creation_date || data.created_date || data.registration_time,
        ),
        updated_date: parseDate(data.updated_date || data.last_updated),
        expiry_date: parseDate(
          data.registry_expiry_date ||
            data.registrar_registration_expiration_date ||
            data.expiry_date ||
            data.expiration_time ||
            data.expire ||
            data.paid_until,
        ),
      },
      whois: {
        name: data.registrant_name || null,
        organization: data.registrant_organization || null,
        street: data.registrant_street || null,
        city: data.registrant_city || null,
        country: data.registrant_country || null,
        state: data.registrant_state_province || data.registrant_state || null,
        postal_code: data.registrant_postal_code || null,
      },
      abuse: {
        email: data.registrar_abuse_contact_email || null,
        phone: data.registrar_abuse_contact_phone || null,
      },
      status: data.domain_status ? parseStatusArray(data.domain_status) : [],
      dnssec: data.dnssec || null,
    };

    log.success(`Got WHOIS data via native whois command for ${domain}`);
    return result;
  } catch (err) {
    log.warn(`Native whois failed for ${domain}: ${(err as Error).message}`);
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

const tryRdapLookup = async (domain: string): Promise<WhoisResult | null> => {
  try {
    const tld = domain.split('.').pop();
    if (!tld) return null;

    const rdapBase = await getRdapUrlForTld(tld);
    if (!rdapBase) {
      log.warn(`No RDAP base found for TLD .${tld}`);
      return null;
    }

    const res = await fetch(`${rdapBase}/domain/${domain}`);
    if (!res.ok) throw new Error(`RDAP request failed with ${res.status}`);
    const json = (await res.json()) as RdapResponse;

    const events = json.events || [];
    const getEvent = (action: string) =>
      events.find((e) => e.eventAction === action)?.eventDate || null;

    // Find registrar entity
    const registrarEntity = json.entities?.find((e) => e.roles?.includes('registrar'));
    const registrarName =
      registrarEntity?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] || null;
    const registrarIanaId =
      registrarEntity?.publicIds?.find((p) => p.type === 'IANA Registrar ID')
        ?.identifier || null;

    // Find abuse contact entity
    const abuseEntity = json.entities?.flatMap(
      (e) => e.entities?.filter((sub) => sub.roles?.includes('abuse')) || [],
    )?.[0];
    const abuseEmail =
      abuseEntity?.vcardArray?.[1]?.find((v) => v[0] === 'email')?.[3] || null;
    const abusePhone =
      abuseEntity?.vcardArray?.[1]
        ?.find((v) => v[0] === 'tel')?.[3]
        ?.replace('tel:', '') || null;

    log.success(`Got WHOIS data via RDAP for ${domain}`);
    return {
      domainName: json.ldhName || null,
      registrar: {
        name: registrarName,
        id: registrarIanaId,
        url: undefined,
        registryDomainId: json.handle || null,
      },
      dates: {
        creation_date: parseDate(getEvent('registration')) || undefined,
        updated_date: parseDate(getEvent('last changed')) || undefined,
        expiry_date: parseDate(getEvent('expiration')) || undefined,
      },
      whois: {
        name: undefined,
        organization: undefined,
        street: undefined,
        city: undefined,
        country: undefined,
        state: undefined,
        postal_code: undefined,
      },
      abuse: {
        email: abuseEmail,
        phone: abusePhone,
      },
      status: json.status || [],
      dnssec: json.secureDNS?.zoneSigned ? 'signed' : null,
    };
  } catch (err) {
    log.warn(`RDAP failed for ${domain}: ${(err as Error).message}`);
    return null;
  }
};

/* We can also try a whois lookup using a third-party API. But, unlikely to work if our whois failed */
const tryWhoisXml = async (domain: string): Promise<WhoisResult | null> => {
  try {
    const url = new URL('https://www.whoisxmlapi.com/whoisserver/WhoisService');
    url.searchParams.set('apiKey', WHOISXML_API_KEY || '');
    url.searchParams.set('outputFormat', 'json');
    url.searchParams.set('domainName', domain);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const record = data?.WhoisRecord?.registryData ?? {};
    const registrant = record?.registrant ?? {};

    return {
      domainName: data?.WhoisRecord?.domainName || null,
      registrar: {
        name: data?.WhoisRecord?.registrarName || record.registrarName || null,
        id: data?.WhoisRecord?.registrarIANAID || null,
        url:
          data?.WhoisRecord?.customField3Value || record.whoisServer
            ? `https://${record.whoisServer}`
            : undefined,
        registryDomainId: record.registryDomainId || null,
      },
      dates: {
        creation_date: parseDate(record.createdDateNormalized),
        expiry_date: parseDate(record.expiresDateNormalized),
        updated_date: parseDate(record.updatedDateNormalized),
      },
      whois: {
        name: registrant.name || null,
        organization: registrant.organization || null,
        street: registrant.street1 || null,
        city: registrant.city || registrant.state || null,
        country: registrant.countryCode || null,
        postal_code: registrant.postalCode || null,
        state: registrant.state || null,
      },
      abuse: {
        email: data?.WhoisRecord?.customField1Value || null,
        phone: data?.WhoisRecord?.customField2Value || null,
      },
      status: parseStatusArray(record.status || data?.WhoisRecord?.status),
      dnssec: null,
    };
  } catch (err) {
    log.warn(`WhoisXML failed for ${domain}: ${(err as Error).message}`);
    return null;
  }
};
