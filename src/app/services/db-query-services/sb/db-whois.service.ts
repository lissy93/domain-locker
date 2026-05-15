import { SaveDomainData } from '~/app/../types/Database';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
// import {  } from '~/app/../types/Database';

export class WhoisQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
  ) {}

  async saveWhoisInfo(domainId: string, whois: SaveDomainData['whois']): Promise<void> {
    if (!whois) return;

    const whoisData = {
      domain_id: domainId,
      name: whois.name,
      organization: whois.organization,
      country: whois.country,
      street: whois.street,
      city: whois.city,
      state: whois.state,
      postal_code: whois.postal_code,
    };

    const { error } = await this.supabase.from('whois_info').insert(whoisData);

    if (error) throw error;
  }
}
