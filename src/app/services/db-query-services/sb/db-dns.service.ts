import { SupabaseClient, User } from '@supabase/supabase-js';
import { catchError, from, map, Observable } from 'rxjs';
import { SaveDomainData } from '~/app/../types/Database';

export class DnsQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
  ) {}

  getDnsRecords(
    recordType: string,
  ): Observable<{ record_value: string; domains: string[] }[]> {
    return from(
      this.supabase
        .from('dns_records')
        .select(
          `
        record_value,
        domains (domain_name)
      `,
        )
        .eq('record_type', recordType),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map((record) => ({
          record_value: record.record_value,
          // @ts-expect-error record.domains shape varies
          domains: record.domains ? [record.domains.domain_name] : [],
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
      const { error } = await this.supabase.from('dns_records').insert(dnsRecords);
      if (error) throw error;
    }
  }
}
