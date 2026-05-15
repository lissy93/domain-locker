import { catchError, map, Observable } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';
import { DbDomain, SaveDomainData } from '~/app/../types/Database';

export class SslQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
    private getFullDomainQuery: () => string,
    private formatDomainData: (domain: Record<string, unknown>) => DbDomain,
  ) {}

  getSslIssuersWithDomainCounts(): Observable<
    { issuer: string; domain_count: number }[]
  > {
    const query = `
      SELECT ssl_certificates.issuer, COUNT(domains.id) AS domain_count
      FROM ssl_certificates
      INNER JOIN domains ON ssl_certificates.domain_id = domains.id
      GROUP BY ssl_certificates.issuer
    `;

    return this.pgApiUtil
      .postToPgExecutor<{ issuer: string; domain_count: number }>(query)
      .pipe(
        map((response) => response.data),
        catchError((error) => this.handleError(error)),
      );
  }

  getDomainsBySslIssuer(issuer: string): Observable<DbDomain[]> {
    const query = `
      SELECT 
        domains.*,
        registrars.name AS registrar_name,
        registrars.url AS registrar_url,
        array_agg(DISTINCT jsonb_build_object('ip_address', ip_addresses.ip_address, 'is_ipv6', ip_addresses.is_ipv6)) AS ip_addresses,
        array_agg(DISTINCT jsonb_build_object('issuer', ssl_certificates.issuer, 'issuer_country', ssl_certificates.issuer_country, 'subject', ssl_certificates.subject, 'valid_from', ssl_certificates.valid_from, 'valid_to', ssl_certificates.valid_to, 'fingerprint', ssl_certificates.fingerprint, 'key_size', ssl_certificates.key_size, 'signature_algorithm', ssl_certificates.signature_algorithm)) AS ssl_certificates,
        jsonb_build_object('name', whois_info.name, 'organization', whois_info.organization, 'country', whois_info.country, 'street', whois_info.street, 'city', whois_info.city, 'state', whois_info.state, 'postal_code', whois_info.postal_code) AS whois_info,
        array_agg(DISTINCT tags.name) AS tags,
        array_agg(DISTINCT jsonb_build_object('notification_type', notification_preferences.notification_type, 'is_enabled', notification_preferences.is_enabled)) AS notification_preferences,
        jsonb_build_object('ip', hosts.ip, 'lat', hosts.lat, 'lon', hosts.lon, 'isp', hosts.isp, 'org', hosts.org, 'as_number', hosts.as_number, 'city', hosts.city, 'region', hosts.region, 'country', hosts.country) AS host,
        array_agg(DISTINCT jsonb_build_object('record_type', dns_records.record_type, 'record_value', dns_records.record_value)) AS dns_records,
        array_agg(DISTINCT domain_statuses.status_code) AS statuses,
        jsonb_build_object('purchase_price', domain_costings.purchase_price, 'current_value', domain_costings.current_value, 'renewal_cost', domain_costings.renewal_cost, 'auto_renew', domain_costings.auto_renew) AS domain_costings,
        array_agg(DISTINCT jsonb_build_object('name', sub_domains.name, 'sd_info', sub_domains.sd_info)) AS sub_domains,
        array_agg(DISTINCT jsonb_build_object('link_name', domain_links.link_name, 'link_url', domain_links.link_url, 'link_description', domain_links.link_description)) AS domain_links
      FROM domains
      LEFT JOIN registrars ON domains.registrar_id = registrars.id
      LEFT JOIN ip_addresses ON domains.id = ip_addresses.domain_id
      LEFT JOIN ssl_certificates ON domains.id = ssl_certificates.domain_id
      LEFT JOIN whois_info ON domains.id = whois_info.domain_id
      LEFT JOIN domain_tags ON domains.id = domain_tags.domain_id
      LEFT JOIN tags ON domain_tags.tag_id = tags.id
      LEFT JOIN notification_preferences ON domains.id = notification_preferences.domain_id
      LEFT JOIN domain_hosts ON domains.id = domain_hosts.domain_id
      LEFT JOIN hosts ON domain_hosts.host_id = hosts.id
      LEFT JOIN dns_records ON domains.id = dns_records.domain_id
      LEFT JOIN domain_statuses ON domains.id = domain_statuses.domain_id
      LEFT JOIN domain_costings ON domains.id = domain_costings.domain_id
      LEFT JOIN sub_domains ON domains.id = sub_domains.domain_id
      LEFT JOIN domain_links ON domains.id = domain_links.domain_id
      WHERE ssl_certificates.issuer = $1
      GROUP BY domains.id, registrars.name, registrars.url, whois_info.name, whois_info.organization, whois_info.country, whois_info.street, whois_info.city, whois_info.state, whois_info.postal_code, domain_costings.purchase_price, domain_costings.current_value, domain_costings.renewal_cost, domain_costings.auto_renew, hosts.ip, hosts.lat, hosts.lon, hosts.isp, hosts.org, hosts.as_number, hosts.city, hosts.region, hosts.country
    `;
    const params = [issuer];

    return this.pgApiUtil.postToPgExecutor<Record<string, unknown>>(query, params).pipe(
      map((response) => response.data.map((domain) => this.formatDomainData(domain))),
      catchError((error) => this.handleError(error)),
    );
  }

  async saveSslInfo(domainId: string, ssl: SaveDomainData['ssl']): Promise<void> {
    if (!ssl) return;

    const query = `
      INSERT INTO ssl_certificates (
        domain_id, issuer, issuer_country, subject, valid_from, valid_to, fingerprint, key_size, signature_algorithm
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    const params = [
      domainId,
      ssl.issuer,
      ssl.issuer_country,
      ssl.subject,
      new Date(ssl.valid_from),
      new Date(ssl.valid_to),
      ssl.fingerprint,
      ssl.key_size,
      ssl.signature_algorithm,
    ];

    try {
      await this.pgApiUtil.postToPgExecutor(query, params).toPromise();
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
}
