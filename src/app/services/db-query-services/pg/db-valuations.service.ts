import { catchError, map, Observable, of } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';

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
  domain_name?: string;
  expiry_date?: string;
  registrar?: string;
  purchase_price: string | number;
  current_value: string | number;
  renewal_cost: string | number;
  auto_renew: boolean;
}

export class ValuationQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
  ) {}

  // Get all domains with costings info
  getDomainCostings(): Observable<DomainCosting[]> {
    const query = `
      SELECT
        dc.domain_id,
        dc.purchase_price,
        dc.current_value,
        dc.renewal_cost,
        dc.auto_renew,
        d.domain_name,
        d.expiry_date,
        r.name AS registrar
      FROM domain_costings dc
      INNER JOIN domains d ON dc.domain_id = d.id
      LEFT JOIN registrars r ON d.registrar_id = r.id
    `;

    return this.pgApiUtil.postToPgExecutor<DomainCostingRow>(query).pipe(
      map((response) => {
        return response.data.map((item) => ({
          domain_id: item.domain_id,
          domain_name: item.domain_name,
          expiry_date: item.expiry_date,
          registrar: item.registrar,
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
    const query = `
      INSERT INTO domain_costings (domain_id, purchase_price, current_value, renewal_cost, auto_renew)
      VALUES ${updates.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
      ON CONFLICT (domain_id) DO UPDATE SET
        purchase_price = EXCLUDED.purchase_price,
        current_value = EXCLUDED.current_value,
        renewal_cost = EXCLUDED.renewal_cost,
        auto_renew = EXCLUDED.auto_renew
    `;

    const params = updates.flatMap((update) => [
      update.domain_id,
      update.purchase_price,
      update.current_value,
      update.renewal_cost,
      update.auto_renew,
    ]);

    return this.pgApiUtil.postToPgExecutor(query, params).pipe(
      map(() => void 0), // Return void after successful execution
      catchError((error) => {
        this.handleError(error);
        return of(void 0);
      }),
    );
  }
}
