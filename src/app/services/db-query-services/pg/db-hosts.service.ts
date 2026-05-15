import { catchError, map, Observable } from 'rxjs';
import { DbDomain, Host } from '~/app/../types/Database';
import { PgApiUtilService } from '~/app/utils/pg-api.util';

export class HostsQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
    private formatDomainData: (domain: Record<string, unknown>) => DbDomain,
  ) {}

  getHosts(): Observable<Host[]> {
    const query = `SELECT * FROM hosts ORDER BY isp ASC;`;

    return this.pgApiUtil.postToPgExecutor<Host>(query).pipe(
      map((response) => response.data),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainCountsByHost(): Observable<Record<string, number>> {
    const query = `SELECT h.isp, COUNT(dh.domain_id) AS domain_count
                   FROM hosts h
                   LEFT JOIN domain_hosts dh ON h.id = dh.host_id
                   GROUP BY h.isp;`;

    return this.pgApiUtil
      .postToPgExecutor<{ isp: string; domain_count: number }>(query)
      .pipe(
        map((response) => {
          const counts: Record<string, number> = {};
          response.data.forEach((item) => {
            counts[item.isp] = item.domain_count;
          });
          return counts;
        }),
        catchError((error) => this.handleError(error)),
      );
  }

  getDomainsByHost(hostIsp: string): Observable<DbDomain[]> {
    const query = `SELECT d.*, 
                          r.name AS registrar_name, 
                          r.url AS registrar_url, 
                          ARRAY_AGG(ip.ip_address) AS ip_addresses,
                          ARRAY_AGG(s.issuer) AS ssl_issuers,
                          ARRAY_AGG(w.name) AS whois_names,
                          ARRAY_AGG(h.isp) AS hosts,
                          ARRAY_AGG(t.name) AS tags
                   FROM domains d
                   LEFT JOIN registrars r ON d.registrar_id = r.id
                   LEFT JOIN ip_addresses ip ON ip.domain_id = d.id
                   LEFT JOIN ssl_certificates s ON s.domain_id = d.id
                   LEFT JOIN whois_info w ON w.domain_id = d.id
                   LEFT JOIN domain_hosts dh ON dh.domain_id = d.id
                   LEFT JOIN hosts h ON dh.host_id = h.id
                   LEFT JOIN domain_tags dt ON dt.domain_id = d.id
                   LEFT JOIN tags t ON dt.tag_id = t.id
                   WHERE h.isp = $1
                   GROUP BY d.id, r.name, r.url;`;

    return this.pgApiUtil
      .postToPgExecutor<Record<string, unknown>>(query, [hostIsp])
      .pipe(
        map((response) => response.data.map(this.formatDomainData)),
        catchError((error) => this.handleError(error)),
      );
  }

  getHostsWithDomainCounts(): Observable<(Host & { domain_count: number })[]> {
    const query = `SELECT h.*, COUNT(dh.domain_id) AS domain_count
                   FROM hosts h
                   LEFT JOIN domain_hosts dh ON h.id = dh.host_id
                   GROUP BY h.id;`;

    return this.pgApiUtil.postToPgExecutor<Host & { domain_count: number }>(query).pipe(
      map((response) => response.data),
      catchError((error) => this.handleError(error)),
    );
  }

  async saveHost(domainId: string, host?: Host): Promise<void> {
    if (!host?.isp || !host?.query) return;

    // Step 1: Check if the host already exists
    const selectQuery = `SELECT id FROM hosts WHERE isp = $1 LIMIT 1;`;
    const selectResponse = await this.pgApiUtil
      .postToPgExecutor<{ id: string }>(selectQuery, [host.isp])
      .toPromise();

    let hostId: string;

    if (selectResponse?.data.length) {
      // Step 2: If host exists, update it
      hostId = selectResponse.data[0].id;
      const updateQuery = `UPDATE hosts SET ip = $1, lat = $2, lon = $3, org = $4, as_number = $5, city = $6, region = $7, country = $8
                           WHERE id = $9;`;

      await this.pgApiUtil
        .postToPgExecutor(updateQuery, [
          host.query,
          host.lat,
          host.lon,
          host.org,
          host.asNumber,
          host.city,
          host.region,
          host.country,
          hostId,
        ])
        .toPromise();
    } else {
      // Step 3: If host does not exist, insert it
      const insertQuery = `INSERT INTO hosts (ip, lat, lon, isp, org, as_number, city, region, country)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                           RETURNING id;`;

      const insertResponse = await this.pgApiUtil
        .postToPgExecutor<{
          id: string;
        }>(insertQuery, [
          host.query,
          host.lat,
          host.lon,
          host.isp,
          host.org,
          host.asNumber,
          host.city,
          host.region,
          host.country,
        ])
        .toPromise();

      if (!insertResponse?.data.length) throw new Error('Failed to insert host');
      hostId = insertResponse.data[0].id;
    }

    // Step 4: Link the host to the domain
    const linkQuery = `INSERT INTO domain_hosts (domain_id, host_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`;
    await this.pgApiUtil.postToPgExecutor(linkQuery, [domainId, hostId]).toPromise();
  }
}
