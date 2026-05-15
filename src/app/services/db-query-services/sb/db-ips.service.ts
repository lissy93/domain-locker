import { SupabaseClient, User } from '@supabase/supabase-js';
import { catchError, from, map, Observable } from 'rxjs';
import { IpAddress } from '~/app/../types/Database';

export class IpQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
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

    const { error } = await this.supabase.from('ip_addresses').insert(dbIpAddresses);

    if (error) throw error;
  }

  getIpAddresses(
    isIpv6: boolean,
  ): Observable<{ ip_address: string; domains: string[] }[]> {
    return from(
      this.supabase.rpc('get_ip_addresses_with_domains', { p_is_ipv6: isIpv6 }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as { ip_address: string; domains: string[] }[];
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  // addIpAddress(ipAddress: Omit<IpAddress, 'id' | 'created_at' | 'updated_at'>): Observable<IpAddress> {
  //   return from(this.supabase
  //     .from('ip_addresses')
  //     .insert(ipAddress)
  //     .single()
  //   ).pipe(
  //     map(({ data, error }) => {
  //       if (error) throw error;
  //       if (!data) throw new Error('Failed to add IP address');
  //       return data as IpAddress;
  //     }),
  //     catchError(error => this.handleError(error))
  //   );
  // }

  // updateIpAddress(id: string, ipAddress: Partial<IpAddress>): Observable<IpAddress> {
  //   return from(this.supabase
  //     .from('ip_addresses')
  //     .update(ipAddress)
  //     .eq('id', id)
  //     .single()
  //   ).pipe(
  //     map(({ data, error }) => {
  //       if (error) throw error;
  //       if (!data) throw new Error('IP address not found');
  //       return data as IpAddress;
  //     }),
  //     catchError(error => this.handleError(error))
  //   );
  // }

  // deleteIpAddress(id: string): Observable<void> {
  //   return from(this.supabase
  //     .from('ip_addresses')
  //     .delete()
  //     .eq('id', id)
  //   ).pipe(
  //     map(({ error }) => {
  //       if (error) throw error;
  //     }),
  //     catchError(error => this.handleError(error))
  //   );
  // }
}
