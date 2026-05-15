import { defineEventHandler, getQuery } from 'h3';
import dns from 'dns';
import tls, { PeerCertificate } from 'tls';
import type { DomainInfo } from '../../types/DomainInfo';
import type { Host } from 'src/types/common';
import { verifyAuth } from '../utils/auth';
import { getWhoisInfo } from '../utils/whois';
import Logger from '../utils/logger';

const log = new Logger('domain-info');

/**
 * Execute a function safely
 * So that if one step fails, the world will not implode
 * Errors are caught and logged, and the endpoint will continue
 * @param fn
 * @param errorMsg
 * @param errors
 * @returns
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
    socket.on('error', reject);
  });

/* Uses the wonderful ip-api to find host location and org of a given IP */
const getHostData = async (ip: string): Promise<Host | undefined> => {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=12249`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.regionName) data.region = data.regionName;
    return data;
  } catch (err) {
    log.warn(`IP info fetch failed: ${(err as Error).message}`);
    return;
  }
};

// --- Main handler ---
export default defineEventHandler(async (event) => {
  const authResult = await verifyAuth(event);
  if (!authResult.success) {
    return { statusCode: 401, body: { error: authResult.error } };
  }

  // Get domain name from query parameters / throw error if not provided
  const { domain } = getQuery(event);
  if (!domain || typeof domain !== 'string') {
    log.warn('Domain name is required for domain info lookup');
    return { error: 'Domain name is required' };
  }

  // Validate domain format (alphanumeric labels separated by dots, no special chars)
  const domainRegex =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  if (!domainRegex.test(domain)) {
    log.warn(`Invalid domain format: ${domain}`);
    return { error: 'Invalid domain format' };
  }

  const errors: string[] = []; // Will hold any errors encountered during the process
  const dunno = null; // Fallback for unknown values

  try {
    // Initiate a whois lookup
    log.info(`Resolving domain info for: ${domain}`);
    const whoisData = await getWhoisInfo(domain);
    if (!whoisData) {
      log.warn(`WHOIS data not found for ${domain}`);
      return { error: 'Failed to fetch WHOIS data' };
    }

    // Validate expiry date - if it's exactly today's date, it's likely a parsing bug
    if (whoisData.dates?.expiry_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (whoisData.dates.expiry_date === todayStr) {
        log.warn(
          `Expiry date is exactly today for ${domain} - likely parsing bug, removing it`,
        );
        whoisData.dates.expiry_date = undefined;
      }
    }

    // Then, gather additional DNS and SSL information
    const [ipv4, ipv6, mx, txt, ns, ssl] = await Promise.all([
      safeExecute(() => getIpAddress(domain), 'IPv4 lookup failed', errors),
      safeExecute(() => getIpv6Address(domain), 'IPv6 lookup failed', errors),
      safeExecute(() => getMxRecords(domain), 'MX records failed', errors),
      safeExecute(() => getTxtRecords(domain), 'TXT records failed', errors),
      safeExecute(() => getNameServers(domain), 'NS records failed', errors),
      safeExecute(
        () => getSslCertificateDetails(domain),
        'SSL cert fetch failed',
        errors,
      ),
    ]);
    const host = ipv4?.[0]
      ? await safeExecute(() => getHostData(ipv4[0]), 'Host info fetch failed', errors)
      : null; // we need at least one IP to get host info

    // Put everything together into a DomainInfo object for response
    const domainInfo: DomainInfo = {
      domainName: whoisData.domainName || domain,
      status: whoisData.status,
      ip_addresses: { ipv4: ipv4 || [], ipv6: ipv6 || [] },
      dates: whoisData.dates || {},
      registrar: whoisData.registrar || {},
      whois: whoisData.whois || {},
      abuse: whoisData.abuse || {},
      host: host || null,
      dns: {
        dnssec: whoisData.dnssec,
        nameServers: ns || [],
        mxRecords: mx || [],
        txtRecords: txt || [],
      },
      ssl: {
        issuer: ssl?.issuer?.O || dunno,
        issuer_country: ssl?.issuer?.C || '',
        valid_from: ssl?.valid_from || '',
        valid_to: ssl?.valid_to || '',
        subject: ssl?.subject?.CN || '',
        fingerprint: ssl?.fingerprint || '',
        key_size: ssl?.bits || 0,
        signature_algorithm: ssl?.asn1Curve || '',
      },
    };

    // All done :)
    log.success(`Successfully resolved: ${domain}`);
    return { domainInfo, errors: errors.length ? errors : undefined };
  } catch (err) {
    // Ahh fuck :(
    log.error(`Fatal error during domain lookup: ${(err as Error).message}`);
    return {
      error: 'An unexpected error occurred while processing domain information',
    };
  }
});
