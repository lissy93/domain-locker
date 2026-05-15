import { Observable } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';

export class StatusQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
  ) {}

  async saveStatuses(domainId: string, statuses?: string[]): Promise<void> {
    if (!statuses || statuses.length === 0) return;

    const query = `
      INSERT INTO domain_statuses (domain_id, status_code)
      VALUES ${statuses.map((_, i) => `($1, $${i + 2})`).join(', ')}
    `;
    const params = [domainId, ...statuses];

    try {
      await this.pgApiUtil.postToPgExecutor(query, params).toPromise();
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
}
