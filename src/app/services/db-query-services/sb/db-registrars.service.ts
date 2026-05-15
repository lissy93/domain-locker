import { SupabaseClient, User } from '@supabase/supabase-js';
import { catchError, from, map, Observable } from 'rxjs';
import { DbDomain, Registrar } from '~/app/../types/Database';

export class RegistrarQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
    private formatDomainData: (data: Record<string, unknown>) => DbDomain,
  ) {}

  getRegistrars(): Observable<Registrar[]> {
    return from(this.supabase.from('registrars').select('*')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Registrar[];
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  // Method to get or insert registrar by name
  async getOrInsertRegistrarId(registrarName: string): Promise<string> {
    const sanitizedName = (registrarName || '').trim().replace(/[/\\?#%]/g, '');
    const { data: existingRegistrar, error: registrarError } = await this.supabase
      .from('registrars')
      .select('id')
      .eq('name', sanitizedName)
      .single();

    if (registrarError && registrarError.code !== 'PGRST116') throw registrarError;

    if (existingRegistrar) {
      return existingRegistrar.id;
    } else {
      const { data: newRegistrar, error: insertError } = await this.supabase
        .from('registrars')
        .insert({ name: sanitizedName })
        .select('id')
        .single();

      if (insertError) throw insertError;
      return newRegistrar.id;
    }
  }

  getDomainCountsByRegistrar(): Observable<Record<string, number>> {
    return from(
      this.supabase.from('domains').select('registrars(name), id', { count: 'exact' }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const counts: Record<string, number> = {};
        const rows = (data || []) as unknown as {
          registrars?: { name?: string } | null;
        }[];
        rows.forEach((item) => {
          const registrarName = item.registrars?.name;
          if (registrarName) {
            counts[registrarName] = (counts[registrarName] || 0) + 1;
          }
        });
        return counts;
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getDomainsByRegistrar(registrarName: string): Observable<DbDomain[]> {
    return from(
      this.supabase
        .from('domains')
        .select(
          `
        *,
        registrars!inner (name, url),
        ip_addresses (ip_address, is_ipv6),
        ssl_certificates (issuer, issuer_country, subject, valid_from, valid_to, fingerprint, key_size, signature_algorithm),
        whois_info (name, organization, country, street, city, state, postal_code),
        domain_hosts (
          hosts (
            ip, lat, lon, isp, org, as_number, city, region, country
          )
        ),
        dns_records (record_type, record_value),
        domain_tags (
          tags (name)
        )
      `,
        )
        .eq('registrars.name', registrarName),
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

  async saveRegistrar(
    domainId: string,
    registrar?: Omit<Registrar, 'id'>,
  ): Promise<void> {
    if (!registrar?.name) return;

    const sanitizedName = (registrar.name || '').trim().replace(/[/\\?#%]/g, '');
    const { data: existingRegistrar, error: fetchError } = await this.supabase
      .from('registrars')
      .select('id')
      .eq('name', sanitizedName)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
    let registrarId: string;

    if (existingRegistrar) {
      registrarId = existingRegistrar.id;
    } else {
      const { data: newRegistrar, error: insertError } = await this.supabase
        .from('registrars')
        .insert({ name: sanitizedName, url: registrar['url'] })
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!newRegistrar) throw new Error('Failed to insert registrar');

      registrarId = newRegistrar.id;
    }

    const { error: updateError } = await this.supabase
      .from('domains')
      .update({ registrar_id: registrarId })
      .eq('id', domainId);

    if (updateError) throw updateError;
  }
}
