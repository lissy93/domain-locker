import { catchError, map, Observable } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';
import { IpAddress } from '~/app/../types/Database';

export class IpQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
  ) {}

  async saveIpAddresses(
    domainId: string,
    ipAddresses?: Omit<IpAddress, 'id' | 'domainId' | 'created_at' | 'updated_at'>[],
  ): Promise<void> {
    if (!ipAddresses || ipAddresses.length === 0) return;

    const dbIpAddresses = ipAddresses.map((ip) => ({
      domain_id: domainId,
      ip_address: ip.ipAddress,
      is_ipv6: ip.isIpv6,
    }));

    const query = `
      INSERT INTO ip_addresses (domain_id, ip_address, is_ipv6)
      VALUES ${dbIpAddresses.map((_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`).join(', ')}
    `;
    const params = dbIpAddresses.flatMap((ip) => [
      ip.domain_id,
      ip.ip_address,
      ip.is_ipv6,
    ]);

    try {
      await this.pgApiUtil.postToPgExecutor(query, params).toPromise();
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  getIpAddresses(
    isIpv6: boolean,
  ): Observable<{ ip_address: string; domains: string[] }[]> {
    const query = `
      SELECT ip_addresses.ip_address, array_agg(domains.domain_name) AS domains
      FROM ip_addresses
      LEFT JOIN domains ON ip_addresses.domain_id = domains.id
      WHERE ip_addresses.is_ipv6 = $1
      GROUP BY ip_addresses.ip_address
    `;
    const params = [isIpv6];

    return this.pgApiUtil
      .postToPgExecutor<{ ip_address: string; domains: string[] }>(query, params)
      .pipe(
        map((response) => response.data),
        catchError((error) => this.handleError(error)),
      );
  }
}
