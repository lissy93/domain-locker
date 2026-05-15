import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { PgApiUtilService } from '~/app/utils/pg-api.util';
import { DbDomain, Link } from '~/app/../types/Database';
import { LinkResponse, ModifiedLink } from '~/app/pages/assets/links/index.page';

interface LinkRow {
  id: string;
  link_name: string;
  link_url: string;
  link_description?: string;
  domain_name?: string;
  domain_id?: string;
}

interface LinkDomainAggregate {
  link_name: string;
  link_url: string;
  link_description?: string;
  link_ids: Set<string>;
  domains: Set<string>;
}

export class LinkQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
    private listDomainNames: () => Observable<DbDomain[]>,
  ) {}

  async updateLinks(domainId: string, links: Link[]): Promise<void> {
    const existingQuery = `SELECT id, link_name, link_url, link_description FROM domain_links WHERE domain_id = $1`;
    const { data: existingLinks } = (await this.pgApiUtil
      .postToPgExecutor(existingQuery, [domainId])
      .toPromise()) as { data: Link[] };

    const linksToAdd = links.filter(
      (newLink) =>
        !existingLinks.some(
          (existingLink) =>
            existingLink.link_name === newLink.link_name &&
            existingLink.link_url === newLink.link_url,
        ),
    );

    const linksToRemove = existingLinks.filter(
      (existingLink) =>
        !links.some(
          (newLink) =>
            newLink.link_name === existingLink.link_name &&
            newLink.link_url === existingLink.link_url,
        ),
    );

    const linksToUpdate = links.filter((newLink) =>
      existingLinks.some(
        (existingLink) =>
          existingLink.link_name === newLink.link_name &&
          (existingLink.link_url !== newLink.link_url ||
            existingLink.link_description !== newLink.link_description),
      ),
    );

    if (linksToAdd.length > 0) {
      const addQuery = `
        INSERT INTO domain_links (domain_id, link_name, link_url, link_description)
        VALUES ${linksToAdd.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ')}`;
      const addParams = [
        domainId,
        ...linksToAdd.flatMap((link) => [
          link.link_name,
          link.link_url,
          link.link_description,
        ]),
      ];
      await this.pgApiUtil.postToPgExecutor(addQuery, addParams).toPromise();
    }

    for (const link of linksToUpdate) {
      const updateQuery = `
        UPDATE domain_links
        SET link_url = $1, link_description = $2
        WHERE domain_id = $3 AND link_name = $4`;
      const updateParams = [
        link.link_url,
        link.link_description,
        domainId,
        link.link_name,
      ];
      await this.pgApiUtil.postToPgExecutor(updateQuery, updateParams).toPromise();
    }

    if (linksToRemove.length > 0) {
      const removeQuery = `
        DELETE FROM domain_links
        WHERE domain_id = $1 AND link_name = ANY($2)`;
      const removeParams = [domainId, linksToRemove.map((link) => link.link_name)];
      await this.pgApiUtil.postToPgExecutor(removeQuery, removeParams).toPromise();
    }
  }

  getAllLinks(): Observable<LinkResponse> {
    const query = `
      SELECT dl.id, dl.link_name, dl.link_url, dl.link_description, d.domain_name
      FROM domain_links dl
      LEFT JOIN domains d ON dl.domain_id = d.id`;

    return this.pgApiUtil.postToPgExecutor<LinkRow>(query).pipe(
      map(({ data }) => {
        const groupedByDomain = data.reduce((acc: Record<string, Link[]>, link) => {
          const domainName = link.domain_name || 'Unknown Domain';
          if (!acc[domainName]) acc[domainName] = [];
          acc[domainName].push({
            id: link.id,
            link_name: link.link_name,
            link_url: link.link_url,
            link_description: link.link_description,
          });
          return acc;
        }, {});

        const linkDomains = data.reduce(
          (acc: Record<string, LinkDomainAggregate>, link) => {
            const key = link.link_url;
            if (!acc[key]) {
              acc[key] = {
                link_name: link.link_name,
                link_url: link.link_url,
                link_description: link.link_description,
                link_ids: new Set(),
                domains: new Set(),
              };
            }
            acc[key].link_ids.add(link.id);
            if (link.domain_name) acc[key].domains.add(link.domain_name);
            return acc;
          },
          {},
        );

        const linksWithDomains: ModifiedLink[] = Object.values(linkDomains).map(
          ({ link_name, link_url, link_description, link_ids, domains }) => ({
            id: undefined,
            link_name,
            link_url,
            link_description,
            link_ids: Array.from(link_ids),
            domains: Array.from(domains),
          }),
        );

        return { groupedByDomain, linksWithDomains };
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  addLinkToDomains(linkData: {
    link_name?: string;
    link_url?: string;
    link_description?: string;
    domains?: string[];
  }): Observable<void> {
    const { link_name, link_url, link_description, domains } = linkData;
    return this.listDomainNames().pipe(
      switchMap((availableDomains) => {
        const validDomains = (domains || []).filter((domain) =>
          availableDomains.map((av) => av.domain_name).includes(domain),
        );
        const fetchQuery = `SELECT id FROM domains WHERE domain_name = ANY($1)`;
        return this.pgApiUtil
          .postToPgExecutor<{ id: string }>(fetchQuery, [validDomains])
          .pipe(
            map(({ data }) => data.map((domain) => domain.id)),
            switchMap((domainIds) => {
              if (domainIds.length === 0) {
                throw new Error('No valid domains found to associate with the link.');
              }

              const insertQuery = `
              INSERT INTO domain_links (domain_id, link_name, link_url, link_description)
              VALUES ${domainIds.map((_, i: number) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}`;
              const insertParams = domainIds.flatMap((id: string) => [
                id,
                link_name,
                link_url,
                link_description,
              ]);
              return this.pgApiUtil
                .postToPgExecutor(insertQuery, insertParams)
                .pipe(map(() => void 0));
            }),
          );
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  deleteLinks(linkIds: string | string[]): Observable<void> {
    const ids = Array.isArray(linkIds) ? linkIds : [linkIds];
    const query = `DELETE FROM domain_links WHERE id = ANY($1)`;
    const params = [ids];

    return this.pgApiUtil.postToPgExecutor(query, params).pipe(
      map(() => void 0),
      catchError((error) => this.handleError(error)),
    );
  }

  updateLinkInDomains(linkData: ModifiedLink): Observable<void> {
    const { link_ids, link_name, link_url, link_description, domains } = linkData;

    return this.listDomainNames().pipe(
      switchMap(
        (availableDomains): Observable<{ id: string; domain_name?: string }[]> => {
          // Filter valid domains
          const validDomains = (domains || []).filter((domain) =>
            availableDomains.map((av) => av.domain_name).includes(domain),
          );
          if (validDomains.length === 0)
            return of([] as { id: string; domain_name?: string }[]);

          // Fetch domain IDs for valid domains
          const fetchDomainQuery = `
          SELECT id, domain_name
          FROM domains
          WHERE domain_name = ANY($1)
        `;
          return this.pgApiUtil
            .postToPgExecutor<{
              id: string;
              domain_name?: string;
            }>(fetchDomainQuery, [validDomains])
            .pipe(map(({ data }) => data || []));
        },
      ),
      switchMap(async (domainData) => {
        if (!link_ids) return;

        // Fetch existing links
        const fetchLinksQuery = `
          SELECT id, domain_id
          FROM domain_links
          WHERE id = ANY($1)
        `;
        const { data: existingLinks } = (await this.pgApiUtil
          .postToPgExecutor(fetchLinksQuery, [link_ids])
          .toPromise()) as { data: Link[] };

        const existingDomainIds =
          existingLinks?.map((link: Link & { domain_id?: string }) => link.domain_id) ||
          [];
        const domainsToAdd = domainData.filter(
          (d: { id: string }) => !existingDomainIds.includes(d.id),
        );
        const domainsToUpdate = domainData.filter((d: { id: string }) =>
          existingDomainIds.includes(d.id),
        ) as DbDomain[];
        const domainsToRemove = existingDomainIds.filter(
          (id) => !domainData.some((d: { id: string }) => d.id === id),
        );

        const tasks: Promise<void>[] = [];

        // Add new links
        if (domainsToAdd.length > 0) {
          const addLinksQuery = `
            INSERT INTO domain_links (domain_id, link_name, link_url, link_description)
            VALUES ${domainsToAdd
              .map(
                (_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`,
              )
              .join(', ')}
          `;
          const addLinksParams = domainsToAdd.flatMap((d: { id: string }) => [
            d.id,
            link_name,
            link_url,
            link_description,
          ]);
          tasks.push(
            this.pgApiUtil
              .postToPgExecutor(addLinksQuery, addLinksParams)
              .toPromise() as Promise<void>,
          );
        }

        // Update existing links
        if (domainsToUpdate.length > 0) {
          for (const domain of domainsToUpdate) {
            const updateLinksQuery = `
              UPDATE domain_links
              SET link_name = $1, link_url = $2, link_description = $3
              WHERE domain_id = $4 AND id = $5
            `;
            const updateLinksParams = [
              link_name,
              link_url,
              link_description,
              domain?.id,
              link_ids.find((id) => existingLinks.some((link) => link.id === id)),
            ];
            tasks.push(
              this.pgApiUtil
                .postToPgExecutor(updateLinksQuery, updateLinksParams)
                .toPromise() as Promise<void>,
            );
          }
        }

        // Remove links for unchecked domains
        if (domainsToRemove.length > 0) {
          const removeLinksQuery = `
            DELETE FROM domain_links
            WHERE domain_id = ANY($1)
          `;
          tasks.push(
            this.pgApiUtil
              .postToPgExecutor(removeLinksQuery, [domainsToRemove])
              .toPromise() as Promise<void>,
          );
        }

        await Promise.all(tasks);
      }),
      map(() => void 0),
      catchError((error) => this.handleError(error)),
    );
  }
}
