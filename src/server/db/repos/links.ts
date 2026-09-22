import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../schema';
import { currentUserId } from './helpers';

export interface LinkInput {
  link_name: string;
  link_url: string;
  link_description?: string | null;
  /** Domain names the link should apply to */
  domains: string[];
}

export function linksRepo(db: Kysely<Database>) {
  function allRows(userId: string) {
    return db
      .selectFrom('domain_links')
      .innerJoin('domains', 'domains.id', 'domain_links.domain_id')
      .where('domains.user_id', '=', userId)
      .select([
        'domain_links.id',
        'domain_links.link_name',
        'domain_links.link_url',
        'domain_links.link_description',
        'domains.domain_name',
      ])
      .orderBy('domain_links.link_name')
      .execute();
  }

  /**
   * Narrows domain names to the ids the user owns. Takes the executor so
   * callers inside a transaction never wait on a second connection, which
   * would deadlock SQLite.
   */
  async function ownedDomainIds(
    executor: Kysely<Database> | Transaction<Database>,
    names: string[],
    userId: string,
  ): Promise<string[]> {
    if (!names.length) return [];
    const rows = await executor
      .selectFrom('domains')
      .where('user_id', '=', userId)
      .where('domain_name', 'in', names)
      .select('id')
      .execute();
    return rows.map((row) => row.id);
  }

  return {
    /**
     * Links both by domain and de-duplicated by url, which is how the
     * assets page renders them.
     */
    async list(userId = currentUserId()) {
      const rows = await allRows(userId);

      const groupedByDomain: Record<
        string,
        {
          id: string;
          link_name: string;
          link_url: string;
          link_description: string | null;
        }[]
      > = {};
      const byUrl = new Map<
        string,
        {
          link_name: string;
          link_url: string;
          link_description: string | null;
          link_ids: string[];
          domains: string[];
        }
      >();

      for (const row of rows) {
        (groupedByDomain[row.domain_name] ??= []).push({
          id: row.id,
          link_name: row.link_name,
          link_url: row.link_url,
          link_description: row.link_description,
        });

        const aggregate = byUrl.get(row.link_url) ?? {
          link_name: row.link_name,
          link_url: row.link_url,
          link_description: row.link_description,
          link_ids: [],
          domains: [],
        };
        aggregate.link_ids.push(row.id);
        if (!aggregate.domains.includes(row.domain_name)) {
          aggregate.domains.push(row.domain_name);
        }
        byUrl.set(row.link_url, aggregate);
      }

      return { groupedByDomain, linksWithDomains: [...byUrl.values()] };
    },

    async forDomain(domainId: string, userId = currentUserId()) {
      return db
        .selectFrom('domain_links')
        .innerJoin('domains', 'domains.id', 'domain_links.domain_id')
        .where('domains.user_id', '=', userId)
        .where('domain_links.domain_id', '=', domainId)
        .select([
          'domain_links.id',
          'domain_links.link_name',
          'domain_links.link_url',
          'domain_links.link_description',
        ])
        .orderBy('domain_links.link_name')
        .execute();
    },

    async add(link: LinkInput, userId = currentUserId()): Promise<number> {
      const domainIds = await ownedDomainIds(db, link.domains, userId);
      if (!domainIds.length) return 0;

      await db
        .insertInto('domain_links')
        .values(
          domainIds.map((domainId) => ({
            domain_id: domainId,
            link_name: link.link_name,
            link_url: link.link_url,
            link_description: link.link_description ?? null,
          })),
        )
        .execute();
      return domainIds.length;
    },

    /** Replaces the given links with one that applies to exactly these domains */
    async update(
      linkIds: string[],
      link: LinkInput,
      userId = currentUserId(),
    ): Promise<void> {
      await db.transaction().execute(async (trx) => {
        if (linkIds.length) {
          await trx
            .deleteFrom('domain_links')
            .where('id', 'in', linkIds)
            .where((eb) =>
              eb.exists(
                eb
                  .selectFrom('domains')
                  .whereRef('domains.id', '=', 'domain_links.domain_id')
                  .where('domains.user_id', '=', userId)
                  .select('domains.id'),
              ),
            )
            .execute();
        }

        const domainIds = await ownedDomainIds(trx, link.domains, userId);
        if (!domainIds.length) return;

        await trx
          .insertInto('domain_links')
          .values(
            domainIds.map((domainId) => ({
              domain_id: domainId,
              link_name: link.link_name,
              link_url: link.link_url,
              link_description: link.link_description ?? null,
            })),
          )
          .execute();
      });
    },

    async remove(linkIds: string[], userId = currentUserId()): Promise<number> {
      if (!linkIds.length) return 0;
      const result = await db
        .deleteFrom('domain_links')
        .where('id', 'in', linkIds)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('domains')
              .whereRef('domains.id', '=', 'domain_links.domain_id')
              .where('domains.user_id', '=', userId)
              .select('domains.id'),
          ),
        )
        .executeTakeFirst();
      return Number(result.numDeletedRows ?? 0);
    },
  };
}

export type LinkListing = Awaited<ReturnType<ReturnType<typeof linksRepo>['list']>>;
