import type { WhoisResult } from '../types';
import { parseDate } from '../dates';
import { parseStatusArray } from '../status';
import { fetchJson } from '../fetch-json';
import { cleanRedacted } from '../normalize';
import Logger from '../../logger';

const log = new Logger('whois');
const WHOISXML_API_KEY = process.env['WHOISXML_API_KEY'];

interface WhoisXmlResponse {
  WhoisRecord?: {
    domainName?: string;
    registrarName?: string;
    registrarIANAID?: string;
    status?: string;
    customField1Value?: string;
    customField2Value?: string;
    registryData?: {
      registrarName?: string;
      whoisServer?: string;
      registryDomainId?: string;
      createdDateNormalized?: string;
      expiresDateNormalized?: string;
      updatedDateNormalized?: string;
      status?: string;
      registrant?: {
        name?: string;
        organization?: string;
        street1?: string;
        city?: string;
        state?: string;
        countryCode?: string;
        postalCode?: string;
      };
    };
  };
}

/* Last resort, a paid third-party API (only when an api key is configured) */
export const tryWhoisXml = async (domain: string): Promise<WhoisResult | null> => {
  if (!WHOISXML_API_KEY) return null;
  try {
    const url = new URL('https://www.whoisxmlapi.com/whoisserver/WhoisService');
    url.searchParams.set('apiKey', WHOISXML_API_KEY);
    url.searchParams.set('outputFormat', 'json');
    url.searchParams.set('domainName', domain);

    const data = await fetchJson<WhoisXmlResponse>(url.toString());
    const whoisRecord = data.WhoisRecord;
    const record = whoisRecord?.registryData;
    const registrant = record?.registrant;

    return {
      domainName: whoisRecord?.domainName || null,
      registrar: {
        name: whoisRecord?.registrarName || record?.registrarName || undefined,
        id: whoisRecord?.registrarIANAID || undefined,
        url: record?.whoisServer ? `https://${record.whoisServer}` : undefined,
        registryDomainId: record?.registryDomainId || undefined,
      },
      dates: {
        creation_date: parseDate(record?.createdDateNormalized),
        expiry_date: parseDate(record?.expiresDateNormalized),
        updated_date: parseDate(record?.updatedDateNormalized),
      },
      whois: {
        name: cleanRedacted(registrant?.name),
        organization: cleanRedacted(registrant?.organization),
        street: cleanRedacted(registrant?.street1),
        city: cleanRedacted(registrant?.city),
        country: cleanRedacted(registrant?.countryCode),
        postal_code: cleanRedacted(registrant?.postalCode),
        state: cleanRedacted(registrant?.state),
      },
      abuse: {
        email: cleanRedacted(whoisRecord?.customField1Value),
        phone: cleanRedacted(whoisRecord?.customField2Value),
      },
      status: parseStatusArray(record?.status || whoisRecord?.status),
      dnssec: null,
    };
  } catch (err) {
    log.warn(`WhoisXML failed for ${domain}: ${(err as Error).message}`);
    return null;
  }
};
