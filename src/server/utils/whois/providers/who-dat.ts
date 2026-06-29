import type { WhoisResult } from '../types';
import { parseDate } from '../dates';
import { parseStatusArray } from '../status';
import { fetchJson } from '../fetch-json';
import { cleanRedacted, hasUsefulWhoisData } from '../normalize';
import Logger from '../../logger';

const log = new Logger('whois');
const WHO_DAT_URL = (process.env['DL_WHO_DAT_URL'] || 'https://who-dat.as93.net').replace(
  /\/+$/,
  '',
);

interface WhoDatResponse {
  domain?: string | null;
  id?: string | null;
  isRegistered?: boolean;
  registrar?: {
    name?: string | null;
    ianaId?: string | null;
    url?: string | null;
    abuseEmail?: string | null;
    abusePhone?: string | null;
  };
  status?: string[];
  dnssec?: { signed?: boolean };
  dates?: { created?: string | null; updated?: string | null; expires?: string | null };
  contacts?: {
    registrant?: {
      name?: string | null;
      organization?: string | null;
      address?: {
        street?: string | null;
        city?: string | null;
        state?: string | null;
        postalCode?: string | null;
        country?: string | null;
      };
    };
  };
  error?: unknown;
}

/* Try who-dat as the first fallback when local whois fails */
export const tryWhoDat = async (domain: string): Promise<WhoisResult | null> => {
  try {
    const data = await fetchJson<WhoDatResponse>(
      `${WHO_DAT_URL}/${encodeURIComponent(domain)}`,
    );
    if (data.error || !data.isRegistered) return null;

    const registrant = data.contacts?.registrant;
    const address = registrant?.address;
    const result: WhoisResult = {
      domainName: data.domain || null,
      registrar: {
        name: cleanRedacted(data.registrar?.name),
        id: cleanRedacted(data.registrar?.ianaId),
        url: cleanRedacted(data.registrar?.url),
        registryDomainId: cleanRedacted(data.id),
      },
      dates: {
        creation_date: parseDate(data.dates?.created),
        updated_date: parseDate(data.dates?.updated),
        expiry_date: parseDate(data.dates?.expires),
      },
      whois: {
        name: cleanRedacted(registrant?.name),
        organization: cleanRedacted(registrant?.organization),
        street: cleanRedacted(address?.street),
        city: cleanRedacted(address?.city),
        country: cleanRedacted(address?.country),
        state: cleanRedacted(address?.state),
        postal_code: cleanRedacted(address?.postalCode),
      },
      abuse: {
        email: cleanRedacted(data.registrar?.abuseEmail),
        phone: cleanRedacted(data.registrar?.abusePhone)?.replace(/^tel:/, ''),
      },
      status: parseStatusArray(data.status),
      dnssec: data.dnssec?.signed ? 'signed' : null,
    };

    if (!hasUsefulWhoisData(result)) return null;
    log.success(`Got WHOIS data via who-dat for ${domain}`);
    return result;
  } catch (err) {
    log.warn(`who-dat failed for ${domain}: ${(err as Error).message}`);
    return null;
  }
};
