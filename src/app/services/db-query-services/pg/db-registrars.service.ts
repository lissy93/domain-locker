import { catchError, map, Observable, switchMap } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';
import {
  dedupeRegistrars,
  matchRegistrarRows,
  mergeRegistrarCounts,
} from '~/app/services/domain-utils.service';
import { DbDomain, Registrar } from '~/app/../types/Database';

export class RegistrarQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
    private formatDomainData: (data: Record<string, unknown>) => DbDomain,
  ) {}

  // Get all registrars, collapsing name variants of the same registrar
  getRegistrars(): Observable<Registrar[]> {
    const query = 'SELECT * FROM registrars';

    return this.pgApiUtil.postToPgExecutor<Registrar>(query).pipe(
      map((response) => dedupeRegistrars(response.data)),
      catchError((error) => this.handleError(error)),
    );
  }

  // Get or insert a registrar, loose-matching existing names to avoid duplicates
  async getOrInsertRegistrarId(registrarName: string, url?: string): Promise<string> {
    const sanitizedName = (registrarName || '').trim().replace(/[/\\?#%]/g, '');
    const selectQuery = 'SELECT id, name FROM registrars';
    const insertQuery = 'INSERT INTO registrars (name, url) VALUES ($1, $2) RETURNING id';

    const selectResponse = await this.pgApiUtil
      .postToPgExecutor<{ id: string; name: string }>(selectQuery)
      .toPromise();
    const existing = matchRegistrarRows(selectResponse?.data || [], sanitizedName)[0];
    if (existing) {
      return existing.id;
    }

    const insertResponse = await this.pgApiUtil
      .postToPgExecutor<{ id: string }>(insertQuery, [sanitizedName, url ?? null])
      .toPromise();
    if (insertResponse && insertResponse.data.length > 0) {
      return insertResponse.data[0].id;
    }
    throw new Error('Failed to insert registrar');
  }

  // Get domain counts by registrar, merged across name variants
  getDomainCountsByRegistrar(): Observable<Record<string, number>> {
    const query = `
      SELECT r.name AS registrar_name, COUNT(d.id) AS domain_count
      FROM registrars r
      -- LEFT JOIN so zero-count variants still feed the canonical name merge
      LEFT JOIN domains d ON d.registrar_id = r.id
      GROUP BY r.name
    `;

    return this.pgApiUtil
      .postToPgExecutor<{ registrar_name: string; domain_count: string }>(query)
      .pipe(
        map((response) => {
          const counts: Record<string, number> = {};
          response.data.forEach((item) => {
            counts[item.registrar_name] = Number(item.domain_count);
          });
          return mergeRegistrarCounts(counts);
        }),
        catchError((error) => this.handleError(error)),
      );
  }

  // Get domains by registrar name, including variant spellings of the same registrar
  getDomainsByRegistrar(registrarName: string): Observable<DbDomain[]> {
    const registrarsQuery = 'SELECT id, name FROM registrars';
    const query = `
    SELECT 
      d.id,
      d.user_id,
      d.domain_name,
      d.expiry_date,
      d.registration_date,
      d.updated_date,
      d.notes,

      -- Registrar
      jsonb_build_object(
        'name', r.name,
        'url', r.url
      ) AS registrar,

      -- IP Addresses
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'ip_address', da.ip_address,
          'is_ipv6', da.is_ipv6
        )) FILTER (WHERE da.ip_address IS NOT NULL),
        '[]'
      ) AS ip_addresses,

      -- SSL Certificates
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'issuer', sc.issuer,
          'issuer_country', sc.issuer_country,
          'subject', sc.subject,
          'valid_from', sc.valid_from,
          'valid_to', sc.valid_to,
          'fingerprint', sc.fingerprint,
          'key_size', sc.key_size,
          'signature_algorithm', sc.signature_algorithm
        )) FILTER (WHERE sc.issuer IS NOT NULL),
        '[]'
      ) AS ssl_certificates,

      -- WHOIS Info
      jsonb_build_object(
        'name', wi.name,
        'organization', wi.organization,
        'country', wi.country,
        'street', wi.street,
        'city', wi.city,
        'state', wi.state,
        'postal_code', wi.postal_code
      ) AS whois_info,

      -- Hosts
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'host_id', dh.host_id
        )) FILTER (WHERE dh.host_id IS NOT NULL),
        '[]'
      ) AS hosts,

      -- DNS Records
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'record_type', dr.record_type,
          'record_value', dr.record_value
        )) FILTER (WHERE dr.record_type IS NOT NULL),
        '[]'
      ) AS dns_records,

      -- Tags
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'name', t.name
        )) FILTER (WHERE t.name IS NOT NULL),
        '[]'
      ) AS tags

    FROM domains d
    INNER JOIN registrars r ON d.registrar_id = r.id
    LEFT JOIN ip_addresses da ON d.id = da.domain_id
    LEFT JOIN ssl_certificates sc ON d.id = sc.domain_id
    LEFT JOIN whois_info wi ON d.id = wi.domain_id
    LEFT JOIN domain_hosts dh ON d.id = dh.domain_id
    LEFT JOIN dns_records dr ON d.id = dr.domain_id
    LEFT JOIN domain_tags dt ON d.id = dt.domain_id
    LEFT JOIN tags t ON dt.tag_id = t.id
    WHERE d.registrar_id = ANY($1::uuid[])
    GROUP BY
      d.id,
      r.name, r.url,
      wi.name, wi.organization, wi.country, wi.street, wi.city, wi.state, wi.postal_code
  `;

    return this.pgApiUtil
      .postToPgExecutor<{ id: string; name: string }>(registrarsQuery)
      .pipe(
        switchMap((registrarsResponse) => {
          const ids = matchRegistrarRows(registrarsResponse.data, registrarName).map(
            (row) => row.id,
          );
          return this.pgApiUtil.postToPgExecutor<Record<string, unknown>>(query, [ids]);
        }),
        map((response) => response.data.map(this.formatDomainData)),
        catchError((error) => this.handleError(error)),
      );
  }

  // Save registrar for a domain
  async saveRegistrar(
    domainId: string,
    registrar?: Omit<Registrar, 'id'>,
  ): Promise<void> {
    if (!registrar?.name) return;

    const registrarId = await this.getOrInsertRegistrarId(registrar.name, registrar.url);

    const updateQuery = 'UPDATE domains SET registrar_id = $1 WHERE id = $2';
    await this.pgApiUtil
      .postToPgExecutor(updateQuery, [registrarId, domainId])
      .toPromise();
  }
}
