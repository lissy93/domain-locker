import { SupabaseClient } from '@supabase/supabase-js';
import { catchError, from, map, Observable } from 'rxjs';

export interface DomainCosting {
  domain_id: string;
  domain_name?: string;
  expiry_date?: string;
  registrar?: string;
  purchase_price: number;
  current_value: number;
  renewal_cost: number;
  auto_renew: boolean;
}

interface DomainCostingRow {
  domain_id: string;
  purchase_price: string | number;
  current_value: string | number;
  renewal_cost: string | number;
  auto_renew: boolean;
  domains?: {
    domain_name?: string;
    expiry_date?: string;
    registrars?: { name?: string } | null;
  } | null;
}

export class ValuationQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
  ) {}

  // Get all domains with costings info
  getDomainCostings(): Observable<DomainCosting[]> {
    return from(
      this.supabase.from('domain_costings').select(`
        domain_id,
        purchase_price,
        current_value,
        renewal_cost,
        auto_renew,
        domains (
          domain_name,
          expiry_date,
          registrar_id,
          registrars (name)
        )
      `),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;

        return (data as unknown as DomainCostingRow[]).map((item) => ({
          domain_id: item.domain_id,
          domain_name: item.domains?.domain_name,
          expiry_date: item.domains?.expiry_date,
          registrar: item.domains?.registrars?.name,
          purchase_price: parseFloat(String(item.purchase_price)) || 0,
          current_value: parseFloat(String(item.current_value)) || 0,
          renewal_cost: parseFloat(String(item.renewal_cost)) || 0,
          auto_renew: item.auto_renew,
        }));
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  // Update costings for all edited domains
  updateDomainCostings(updates: DomainCosting[]): Observable<void> {
    return from(
      this.supabase
        .from('domain_costings')
        .upsert(updates, { onConflict: 'domain_id' })
        .then((response) => {
          if (response.error) {
            throw response.error;
          }
        }),
    );
  }
}
