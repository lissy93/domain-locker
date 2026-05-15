import { SupabaseClient, User } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
// import {  } from '~/app/../types/Database';

export class StatusQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
  ) {}

  async saveStatuses(domainId: string, statuses?: string[]): Promise<void> {
    if (!statuses || statuses.length === 0) return;
    const statusEntries = statuses.map((status) => ({
      domain_id: domainId,
      status_code: status,
    }));
    const { error } = await this.supabase.from('domain_statuses').insert(statusEntries);
    if (error) throw error;
  }
}
