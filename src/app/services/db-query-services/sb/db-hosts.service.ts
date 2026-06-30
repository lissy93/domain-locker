import { SupabaseClient } from '@supabase/supabase-js';
import { catchError, from, map, Observable } from 'rxjs';
import { DbDomain, Host } from '~/app/../types/Database';

export class HostsQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private formatDomainData: (domain: Record<string, unknown>) => DbDomain,
  ) {}

  getHosts(): Observable<Host[]> {
    return from(
      this.supabase.from('hosts').select('*').order('isp', { ascending: true }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Host[];
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainCountsByHost(): Observable<Record<string, number>> {
    return from(
      this.supabase
        .from('domain_hosts')
        .select('hosts(isp), domain_id', { count: 'exact' }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const counts: Record<string, number> = {};
        const rows = (data || []) as unknown as { hosts?: { isp?: string } | null }[];
        rows.forEach((item) => {
          const isp = item.hosts?.isp;
          if (isp) {
            counts[isp] = (counts[isp] || 0) + 1;
          }
        });
        return counts;
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainsByHost(hostIsp: string): Observable<DbDomain[]> {
    return from(
      this.supabase
        .from('domains')
        .select(
          `
        *,
        registrars (name, url),
        ip_addresses (ip_address, is_ipv6),
        ssl_certificates (issuer, issuer_country, subject, valid_from, valid_to, fingerprint, key_size, signature_algorithm),
        whois_info (name, organization, country, street, city, state, postal_code),
        domain_hosts!inner (
          hosts!inner (
            ip, lat, lon, isp, org, as_number, city, region, country
          )
        ),
        dns_records (record_type, record_value),
        domain_tags (
          tags (name)
        )
      `,
        )
        .eq('domain_hosts.hosts.isp', hostIsp),
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

  getHostsWithDomainCounts(): Observable<(Host & { domain_count: number })[]> {
    return from(
      this.supabase.from('hosts').select(`
        *,
        domain_hosts (domain_id),
        domains!inner(user_id)
      `),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map((host) => ({
          ...host,
          domain_count: host.domain_hosts.length,
        }));
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  async saveHost(domainId: string, host?: Host): Promise<void> {
    if (!host?.isp || !host?.query) return;
    // First, try to find an existing host with the same ISP
    const { data: existingHost, error: fetchError } = await this.supabase
      .from('hosts')
      .select('id')
      .eq('isp', host.isp)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    let hostId: string;

    if (existingHost) {
      hostId = existingHost.id;

      // Update the existing host with the new information
      const { error: updateError } = await this.supabase
        .from('hosts')
        .update({
          ip: host.query,
          lat: host.lat,
          lon: host.lon,
          org: host.org,
          as_number: host.asNumber,
          city: host.city,
          region: host.region,
          country: host.country,
        })
        .eq('id', hostId);

      if (updateError) throw updateError;
    } else {
      // If no existing host found, insert a new one
      const { data: newHost, error: insertError } = await this.supabase
        .from('hosts')
        .insert({
          ip: host.query,
          lat: host.lat,
          lon: host.lon,
          isp: host.isp,
          org: host.org,
          as_number: host.asNumber,
          city: host.city,
          region: host.region,
          country: host.country,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!newHost) throw new Error('Failed to insert host');
      hostId = newHost.id;
    }

    // Link the host to the domain
    const { error: linkError } = await this.supabase
      .from('domain_hosts')
      .insert({ domain_id: domainId, host_id: hostId });

    if (linkError) throw linkError;
  }
}
