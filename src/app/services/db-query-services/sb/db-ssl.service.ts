import { SupabaseClient, User } from '@supabase/supabase-js';
import { catchError, from, map, Observable } from 'rxjs';
import { DbDomain, SaveDomainData } from '~/app/../types/Database';

export class SslQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
    private getFullDomainQuery: () => string,
    private formatDomainData: (domain: Record<string, unknown>) => DbDomain,
  ) {}

  getSslIssuersWithDomainCounts(): Observable<
    { issuer: string; domain_count: number }[]
  > {
    return from(this.supabase.rpc('get_ssl_issuers_with_domain_counts')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as { issuer: string; domain_count: number }[];
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainsBySslIssuer(issuer: string): Observable<DbDomain[]> {
    return from(
      this.supabase
        .from('domains')
        .select(this.getFullDomainQuery())
        .eq('ssl_certificates.issuer', issuer),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as unknown as Record<string, unknown>[]).map((domain) =>
          this.formatDomainData(domain),
        );
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  async saveSslInfo(domainId: string, ssl: SaveDomainData['ssl']): Promise<void> {
    if (!ssl) return;

    const sslData = {
      domain_id: domainId,
      issuer: ssl.issuer,
      issuer_country: ssl.issuer_country,
      subject: ssl.subject,
      valid_from: new Date(ssl.valid_from),
      valid_to: new Date(ssl.valid_to),
      fingerprint: ssl.fingerprint,
      key_size: ssl.key_size,
      signature_algorithm: ssl.signature_algorithm,
    };

    const { error } = await this.supabase.from('ssl_certificates').insert(sslData);

    if (error) throw error;
  }
}
