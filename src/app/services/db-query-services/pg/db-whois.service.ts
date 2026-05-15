import { SaveDomainData } from '~/app/../types/Database';
import { Observable } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';

export class WhoisQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
  ) {}

  async saveWhoisInfo(domainId: string, whois: SaveDomainData['whois']): Promise<void> {
    if (!whois) return;

    const query = `
      INSERT INTO whois_info (
        domain_id, name, organization, country, street, city, state, postal_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const params = [
      domainId,
      whois.name,
      whois.organization,
      whois.country,
      whois.street,
      whois.city,
      whois.state,
      whois.postal_code,
    ];

    try {
      await this.pgApiUtil.postToPgExecutor(query, params).toPromise();
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
}
