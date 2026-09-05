import dns from 'dns';
import tls, { PeerCertificate } from 'tls';
import type { DomainInfo } from '../../types/DomainInfo';
import type { Abuse, Contact, Dates, Dns, Host, Registrar } from '../../types/common';
import { getWhoisInfo } from './whois';
import { parseDate } from './whois/dates';
import Logger from './logger';

const log = new Logger('domain-info');
const SECONDARY_LOOKUP_TIMEOUT_MS = 5000;

/** Alphanumeric labels separated by dots, no special chars */
const DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export const isValidDomain = (domain: string): boolean => DOMAIN_PATTERN.test(domain);

/**
 * Same as DomainData, except might be incomplete
 * Since registries often don't give back all the fields :(
 */
export type DomainLookup = Omit<
  DomainInfo,
  'dates' | 'registrar' | 'whois' | 'abuse' | 'dns'
> & {
  dates: Partial<Dates>;
  registrar: Partial<Registrar>;
  whois: Partial<Contact>;
  abuse: Partial<Abuse>;
  /** WHOIS reports dnssec as a string, or null where it says nothing at all */
  dns: Partial<Omit<Dns, 'dnssec'>> & { dnssec?: string | null };
};

/**
 * Execute a function safely
 * So that if one step fails, the world will not implode
 * Errors are caught and logged, and the lookup will continue
 */
const safeExecute = async <T>(
  fn: () => Promise<T>,
  errorMsg: string,
  errors: string[],
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (err) {
    errors.push(errorMsg);
    log.warn(`${errorMsg}: ${(err as Error).message}`);
    return;
  }
};

/* Looks up IP (v4) address/s of a given hostname */
const getIpAddress = (domain: string) =>
  new Promise<string[]>((resolve) => {
    dns.resolve4(domain, (err, addresses) => resolve(err ? [] : addresses));
  });

/* Looks up IP (v6) address/s of a given hostname */
const getIpv6Address = (domain: string) =>
  new Promise<string[]>((resolve) => {
    dns.resolve6(domain, (err, addresses) => resolve(err ? [] : addresses));
  });

/* Looks up mail records of a given domain */
const getMxRecords = (domain: string) =>
  new Promise<string[]>((resolve) => {
    dns.resolveMx(domain, (err, records) =>
      resolve(err ? [] : records.map((r) => `${r.exchange} (priority: ${r.priority})`)),
    );
  });

/* Looks up TXT records of a given domain */
const getTxtRecords = (domain: string) =>
  new Promise<string[]>((resolve) => {
    dns.resolveTxt(domain, (err, records) =>
      resolve(err ? [] : records.flatMap((r) => r)),
    );
  });

/* Looks up name servers of a given domain */
const getNameServers = (domain: string) =>
  new Promise<string[]>((resolve) => {
    dns.resolveNs(domain, (err, records) => resolve(err ? [] : records));
  });

/* Uses TLS to get certificate info of a given host/domain, if https enabled */
const getSslCertificateDetails = (domain: string): Promise<Partial<PeerCertificate>> =>
  new Promise((resolve, reject) => {
    const socket = tls.connect(443, domain, { servername: domain }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (cert) resolve(cert);
      else reject(new Error('No certificate found'));
    });
    socket.setTimeout(SECONDARY_LOOKUP_TIMEOUT_MS, () => {
      socket.destroy();
      reject(new Error('SSL certificate lookup timed out'));
    });
    socket.on('error', reject);
  });

/* Uses the wonderful ip-api to find host location and org of a given IP */
const getHostData = async (ip: string): Promise<Host | undefined> => {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=12249`, {
      signal: AbortSignal.timeout(SECONDARY_LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.regionName) data.region = data.regionName;
    return data;
  } catch (err) {
    log.warn(`IP info fetch failed: ${(err as Error).message}`);
    return;
  }
};

/**
 * Resolves everything known about a domain, from WHOIS, DNS, TLS and ip-api.
 * Callable in-process, so the updater does not have to call the app over HTTP
 */
export async function lookupDomainInfo(
  domain: string,
): Promise<{ domainInfo: DomainLookup; errors?: string[] }> {
  const errors: string[] = [];
  const dunno = null; // Fallback for unknown values

  // A registry that withholds WHOIS shouldn't cost the domain its DNS, SSL
  // and host data too, so a failure here is recorded and the rest continues
  log.info(`Resolving domain info for: ${domain}`);
  const whoisData = await safeExecute(
    () => getWhoisInfo(domain),
    'WHOIS lookup failed',
    errors,
  );
  if (whoisData === null) {
    log.warn(`WHOIS data not found for ${domain}`);
    errors.push('WHOIS data not found');
  }

  // Then, gather additional DNS and SSL information
  const [ipv4, ipv6, mx, txt, ns, ssl] = await Promise.all([
    safeExecute(() => getIpAddress(domain), 'IPv4 lookup failed', errors),
    safeExecute(() => getIpv6Address(domain), 'IPv6 lookup failed', errors),
    safeExecute(() => getMxRecords(domain), 'MX records failed', errors),
    safeExecute(() => getTxtRecords(domain), 'TXT records failed', errors),
    safeExecute(() => getNameServers(domain), 'NS records failed', errors),
    safeExecute(() => getSslCertificateDetails(domain), 'SSL cert fetch failed', errors),
  ]);
  const host = ipv4?.[0]
    ? await safeExecute(() => getHostData(ipv4[0]), 'Host info fetch failed', errors)
    : null; // we need at least one IP to get host info

  const domainInfo: DomainLookup = {
    domainName: whoisData?.domainName || domain,
    status: whoisData?.status || [],
    ip_addresses: { ipv4: ipv4 || [], ipv6: ipv6 || [] },
    dates: whoisData?.dates || {},
    registrar: whoisData?.registrar || {},
    whois: whoisData?.whois || {},
    abuse: whoisData?.abuse || {},
    host: host || null,
    dns: {
      dnssec: whoisData?.dnssec,
      nameServers: ns || [],
      mxRecords: mx || [],
      txtRecords: txt || [],
    },
    ssl: {
      issuer: ssl?.issuer?.O || dunno,
      issuer_country: ssl?.issuer?.C || '',
      valid_from: parseDate(ssl?.valid_from) || '',
      valid_to: parseDate(ssl?.valid_to) || '',
      subject: ssl?.subject?.CN || '',
      fingerprint: ssl?.fingerprint || '',
      key_size: ssl?.bits || 0,
      signature_algorithm: ssl?.asn1Curve || '',
    },
  };

  log.success(`Successfully resolved: ${domain}`);
  return { domainInfo, errors: errors.length ? errors : undefined };
}
