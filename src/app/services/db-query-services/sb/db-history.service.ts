import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { catchError, from, map, Observable, of } from 'rxjs';

export interface DomainUpdateRow {
  id?: string;
  domain_id?: string;
  domain_name?: string;
  change_type: string;
  change?: string;
  date: string;
  old_value?: string;
  new_value?: string;
  domains?: { domain_name?: string };
}

export interface HistoryEntry {
  date: string;
  added: number;
  removed: number;
  updated: number;
}

export class HistoryQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
  ) {}

  getChangeHistory(domainName?: string, days = 7): Observable<HistoryEntry[]> {
    let query = this.supabase
      .from('domain_updates')
      .select('change_type, date')
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (domainName) {
      query = query.eq('domains.domain_name', domainName);
    }

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) {
          this.handleError(error);
          throw error;
        }

        // Process data to group by date and change_type
        const historyMap: Record<
          string,
          { added: number; removed: number; updated: number }
        > = {};

        data.forEach((entry: { date: string; change_type: string }) => {
          const date = new Date(entry.date).toISOString().split('T')[0]; // Extract day
          if (!historyMap[date]) {
            historyMap[date] = { added: 0, removed: 0, updated: 0 };
          }
          if (entry.change_type === 'added') {
            historyMap[date].added += 1;
          } else if (entry.change_type === 'removed') {
            historyMap[date].removed += 1;
          } else {
            historyMap[date].updated += 1;
          }
        });

        return Object.entries(historyMap).map(([date, counts]) => ({
          date,
          ...counts,
        }));
      }),
      catchError((error) => {
        this.handleError({
          message: 'Error fetching change history',
          error,
          location: 'HistoryQueries.getChangeHistory',
        });
        return of([]);
      }),
    );
  }

  getTotalUpdateCount(domainName?: string): Observable<number> {
    let query: PromiseLike<{ count: number | null; error: PostgrestError | null }> =
      this.supabase.from('domain_updates').select('id', { count: 'exact' });

    if (domainName) {
      query = this.supabase
        .from('domain_updates')
        .select('id, domains!inner(domain_name)', { count: 'exact' })
        .eq('domains.domain_name', domainName);
    }

    return from(
      query.then(
        ({ count, error }: { count: number | null; error: PostgrestError | null }) => {
          if (error) throw error;
          return count || 0;
        },
      ),
    ).pipe(
      catchError((error) => {
        this.handleError({
          message: 'Error fetching total update count',
          error,
          location: 'HistoryQueries.getTotalUpdateCount',
        });
        return of(0);
      }),
    );
  }

  getDomainUpdates(
    domainName?: string,
    start = 0,
    end = 24,
    category?: string,
    changeType?: string,
    filterDomain?: string,
  ): Observable<DomainUpdateRow[]> {
    let query = this.supabase
      .from('domain_updates')
      .select(
        `
        *,
        domains!inner(domain_name)
      `,
      )
      .order('date', { ascending: false })
      .range(start, end);

    if (domainName) {
      query = query.eq('domains.domain_name', domainName);
    }
    if (category) {
      query = query.eq('change', category);
    }
    if (changeType) {
      query = query.eq('change_type', changeType);
    }
    if (filterDomain) {
      query = query.ilike('domains.domain_name', `%${filterDomain}%`);
    }

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []) as DomainUpdateRow[];
      }),
      catchError((error) => {
        this.handleError({
          error,
          message: 'Error fetching domain updates',
          location: 'HistoryQueries.getDomainUpdates',
        });
        return of([]);
      }),
    );
  }
}
