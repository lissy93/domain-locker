import { SupabaseClient, User } from '@supabase/supabase-js';
import { catchError, from, map, Observable } from 'rxjs';
import {
  dedupeRegistrars,
  matchRegistrarRows,
  mergeRegistrarCounts,
} from '~/app/services/domain-utils.service';
import { DbDomain, Registrar } from '~/app/../types/Database';

export class RegistrarQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
    private formatDomainData: (data: Record<string, unknown>) => DbDomain,
  ) {}

  // Get all registrars, collapsing name variants of the same registrar
  getRegistrars(): Observable<Registrar[]> {
    return from(this.supabase.from('registrars').select('*')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return dedupeRegistrars(data as Registrar[]);
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  // Get or insert a registrar, loose-matching existing names to avoid duplicates
  async getOrInsertRegistrarId(registrarName: string, url?: string): Promise<string> {
    const sanitizedName = (registrarName || '').trim().replace(/[/\\?#%]/g, '');
    const { data: registrars, error: registrarError } = await this.supabase
      .from('registrars')
      .select('id, name');

    if (registrarError) throw registrarError;

    const existing = matchRegistrarRows(registrars || [], sanitizedName)[0];
    if (existing) {
      return existing.id;
    }

    const { data: newRegistrar, error: insertError } = await this.supabase
      .from('registrars')
      .insert({ name: sanitizedName, url: url ?? null })
      .select('id')
      .single();

    if (insertError) throw insertError;
    if (!newRegistrar) throw new Error('Failed to insert registrar');
    return newRegistrar.id;
  }

  // Get domain counts by registrar, merged across name variants
  getDomainCountsByRegistrar(): Observable<Record<string, number>> {
    const fetchCounts = async (): Promise<Record<string, number>> => {
      const [namesResult, domainsResult] = await Promise.all([
        this.supabase.from('registrars').select('name'),
        this.supabase.from('domains').select('registrars(name)'),
      ]);
      if (namesResult.error) throw namesResult.error;
      if (domainsResult.error) throw domainsResult.error;

      const counts: Record<string, number> = {};
      const rows = (domainsResult.data || []) as unknown as {
        registrars?: { name?: string } | null;
      }[];
      rows.forEach((item) => {
        const registrarName = item.registrars?.name;
        if (registrarName) {
          counts[registrarName] = (counts[registrarName] || 0) + 1;
        }
      });

      const allNames = (namesResult.data || []).map((row) => row.name);
      return mergeRegistrarCounts(counts, allNames);
    };

    return from(fetchCounts()).pipe(catchError((error) => this.handleError(error)));
  }

  // Get domains for a registrar, including variant spellings of its name
  getDomainsByRegistrar(registrarName: string): Observable<DbDomain[]> {
    const fetchDomains = async () => {
      const { data: registrars, error: registrarsError } = await this.supabase
        .from('registrars')
        .select('id, name');
      if (registrarsError) throw registrarsError;

      const ids = matchRegistrarRows(registrars || [], registrarName).map(
        (row) => row.id,
      );
      if (!ids.length) return { data: [], error: null };

      return this.supabase
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
        .in('registrar_id', ids);
    };

    return from(fetchDomains()).pipe(
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

    const registrarId = await this.getOrInsertRegistrarId(registrar.name, registrar.url);

    const { error: updateError } = await this.supabase
      .from('domains')
      .update({ registrar_id: registrarId })
      .eq('id', domainId);

    if (updateError) throw updateError;
  }
}
