import { catchError, map, Observable } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';
import { SaveDomainData } from '~/app/../types/Database';

interface DnsRecordRow {
  record_value: string;
  domain_name: string | null;
}

export class DnsQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<{ id: string } | null>,
  ) {}

  getDnsRecords(
    recordType: string,
  ): Observable<{ record_value: string; domains: string[] }[]> {
    const query = `
      SELECT dns_records.record_value, domains.domain_name
      FROM dns_records
      INNER JOIN domains ON dns_records.domain_id = domains.id
      WHERE dns_records.record_type = $1
    `;

    return this.pgApiUtil.postToPgExecutor<DnsRecordRow>(query, [recordType]).pipe(
      map((response) => {
        return response.data.map((record) => ({
          record_value: record.record_value,
          domains: record.domain_name ? [record.domain_name] : [],
        }));
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  async saveDnsRecords(domainId: string, dns: SaveDomainData['dns']): Promise<void> {
    if (!dns) return;

    const dnsRecords: { domain_id: string; record_type: string; record_value: string }[] =
      [];

    const recordTypes = ['mxRecords', 'txtRecords', 'nameServers'] as const;
    const typeMap = { mxRecords: 'MX', txtRecords: 'TXT', nameServers: 'NS' };

    recordTypes.forEach((type) => {
      dns[type]?.forEach((record) => {
        dnsRecords.push({
          domain_id: domainId,
          record_type: typeMap[type],
          record_value: record,
        });
      });
    });

    if (dnsRecords.length > 0) {
      const placeholders = dnsRecords
        .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
        .join(', ');
      const values = dnsRecords.flatMap((record) => [
        record.domain_id,
        record.record_type,
        record.record_value,
      ]);

      const query = `
        INSERT INTO dns_records (domain_id, record_type, record_value)
        VALUES ${placeholders}
        ON CONFLICT (domain_id, record_type, record_value) DO NOTHING
      `;

      try {
        await this.pgApiUtil.postToPgExecutor(query, values).toPromise();
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    }
  }
}
