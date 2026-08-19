import type { Kysely } from 'kysely';
import type { Database } from '../schema';
import { domainsRepo, type DomainRecord } from './domains';
import { currentUserId } from './helpers';

/** Flat, spreadsheet-friendly rows built from the full domain records */
export function exportRepo(db: Kysely<Database>) {
  const domains = domainsRepo(db);

  return {
    async rows(
      domainNames?: string[],
      userId = currentUserId(),
    ): Promise<Record<string, unknown>[]> {
      const all = await domains.list(userId);
      const wanted = domainNames?.length
        ? new Set(domainNames.map((name) => name.toLowerCase()))
        : null;

      return all
        .filter((domain) => !wanted || wanted.has(domain.domain_name.toLowerCase()))
        .map(flatten);
    },
  };
}

function flatten(domain: DomainRecord): Record<string, unknown> {
  return {
    domain_name: domain.domain_name,
    expiry_date: domain.expiry_date ?? '',
    registration_date: domain.registration_date ?? '',
    updated_date: domain.updated_date ?? '',
    notes: domain.notes ?? '',
    registrar_name: domain.registrar?.name ?? '',
    registrar_url: domain.registrar?.url ?? '',
    ip_addresses: domain.ip_addresses.map((ip) => ip.ip_address).join(', '),
    ssl_certificates: (domain.ssl?.['issuer'] as string) ?? '',
    whois_name: whoisField(domain, 'name'),
    whois_organization: whoisField(domain, 'organization'),
    whois_country: whoisField(domain, 'country'),
    whois_street: whoisField(domain, 'street'),
    whois_city: whoisField(domain, 'city'),
    whois_state: whoisField(domain, 'state'),
    whois_postal_code: whoisField(domain, 'postal_code'),
    tags: domain.tags.join(', '),
    hosts: (domain.host?.['isp'] as string) ?? '',
    dns_records: [
      ...domain.dns.mxRecords.map((value) => `MX: ${value}`),
      ...domain.dns.txtRecords.map((value) => `TXT: ${value}`),
      ...domain.dns.nameServers.map((value) => `NS: ${value}`),
    ].join('; '),
    statuses: domain.statusCodes.join(', '),
    sub_domains: domain.sub_domains.map((sub) => sub.name).join(', '),
    purchase_price: domain.domain_costings?.purchase_price ?? 0,
    current_value: domain.domain_costings?.current_value ?? 0,
    renewal_cost: domain.domain_costings?.renewal_cost ?? 0,
    auto_renew: domain.domain_costings?.auto_renew ? 'Yes' : 'No',
  };
}

function whoisField(domain: DomainRecord, field: string): string {
  return domain.whois?.[field] ?? '';
}
