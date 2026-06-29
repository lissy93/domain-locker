import type { WhoisResult } from '../types';
import { parseDate } from '../dates';
import { parseStatusArray } from '../status';
import { cleanRedacted } from '../normalize';

export type RawWhois = Record<string, unknown> & {
  error?: unknown;
  registrar?: string | { name?: string } | null;
  registrarName?: string;
  dates?: Record<string, string | undefined>;
};

/* Converts the mystery whois-json structure into a WhoisResult */
export const normalizeWhoisJson = (raw: RawWhois): WhoisResult => {
  const str = (key: string): string | undefined => {
    const v = raw[key];
    return typeof v === 'string' ? v : undefined;
  };
  const registrarObj =
    typeof raw.registrar === 'object' && raw.registrar ? raw.registrar : undefined;
  return {
    domainName: str('domainName') || null,
    registrar: {
      name:
        str('registrarName') ||
        (typeof raw.registrar === 'string' ? raw.registrar : registrarObj?.name) ||
        undefined,
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
      name: cleanRedacted(str('registrantName')),
      organization: cleanRedacted(str('registrantOrganization')),
      street: cleanRedacted(str('registrantStreet')),
      city: cleanRedacted(str('registrantCity')),
      country: cleanRedacted(str('registrantCountry')),
      state: cleanRedacted(str('registrantStateProvince')),
      postal_code: cleanRedacted(str('registrantPostalCode')),
    },
    abuse: {
      email:
        cleanRedacted(str('abuseContactEmail')) ||
        cleanRedacted(str('registrarAbuseContactEmail')),
      phone:
        cleanRedacted(str('abuseContactPhone')) ||
        cleanRedacted(str('registrarAbuseContactPhone')),
    },
    status: parseStatusArray(str('domainStatus') || str('status')),
    dnssec: str('dnssec') || null,
  };
};
