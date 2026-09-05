import type { Kysely } from 'kysely';
import type { Database } from '../schema';
import { currentUserId, toJsonString } from './helpers';

export interface SubdomainInput {
  name: string;
  sd_info?: unknown;
}

export function subdomainsRepo(db: Kysely<Database>) {
  /** Resolves a domain name to an id the caller owns */
  async function ownedDomainId(
    domainName: string,
    userId: string,
  ): Promise<string | null> {
    const domain = await db
      .selectFrom('domains')
      .where('user_id', '=', userId)
      .where('domain_name', '=', domainName)
      .select('id')
      .executeTakeFirst();
    return domain?.id ?? null;
  }

  function serialise(info: unknown): string | null {
    if (info === undefined || info === null) return null;
    return typeof info === 'string' ? info : JSON.stringify(info);
  }

  return {
    async listAll(userId = currentUserId()) {
      const rows = await db
        .selectFrom('sub_domains')
        .innerJoin('domains', 'domains.id', 'sub_domains.domain_id')
        .where('domains.user_id', '=', userId)
        .select([
          'sub_domains.id',
          'sub_domains.name',
          'sub_domains.sd_info',
          'domains.domain_name',
        ])
        .orderBy(['domains.domain_name', 'sub_domains.name'])
        .execute();
      return rows.map((row) => ({ ...row, sd_info: toJsonString(row.sd_info) }));
    },

    async byDomain(domainName: string, userId = currentUserId()) {
      const rows = await db
        .selectFrom('sub_domains')
        .innerJoin('domains', 'domains.id', 'sub_domains.domain_id')
        .where('domains.user_id', '=', userId)
        .where('domains.domain_name', '=', domainName)
        .select(['sub_domains.id', 'sub_domains.name', 'sub_domains.sd_info'])
        .orderBy('sub_domains.name')
        .execute();
      return rows.map((row) => ({ ...row, sd_info: toJsonString(row.sd_info) }));
    },

    async info(domainName: string, subdomain: string, userId = currentUserId()) {
      const row = await db
        .selectFrom('sub_domains')
        .innerJoin('domains', 'domains.id', 'sub_domains.domain_id')
        .where('domains.user_id', '=', userId)
        .where('domains.domain_name', '=', domainName)
        .where('sub_domains.name', '=', subdomain)
        .select(['sub_domains.name', 'sub_domains.sd_info', 'domains.domain_name'])
        .executeTakeFirst();
      return row ? { ...row, sd_info: toJsonString(row.sd_info) } : null;
    },

    /** Replaces the domain's subdomains with exactly the list given */
    async replaceForDomain(
      domainName: string,
      subdomains: SubdomainInput[],
      userId = currentUserId(),
    ): Promise<boolean> {
      const domainId = await ownedDomainId(domainName, userId);
      if (!domainId) return false;

      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('sub_domains').where('domain_id', '=', domainId).execute();
        if (!subdomains.length) return;
        await trx
          .insertInto('sub_domains')
          .values(
            subdomains.map((subdomain) => ({
              domain_id: domainId,
              name: subdomain.name,
              sd_info: serialise(subdomain.sd_info),
            })),
          )
          .execute();
      });
      return true;
    },

    async add(
      domainName: string,
      subdomain: SubdomainInput,
      userId = currentUserId(),
    ): Promise<boolean> {
      const domainId = await ownedDomainId(domainName, userId);
      if (!domainId) return false;
      await db
        .insertInto('sub_domains')
        .values({
          domain_id: domainId,
          name: subdomain.name,
          sd_info: serialise(subdomain.sd_info),
        })
        .execute();
      return true;
    },

    async remove(
      domainName: string,
      subdomain: string,
      userId = currentUserId(),
    ): Promise<boolean> {
      const domainId = await ownedDomainId(domainName, userId);
      if (!domainId) return false;
      const result = await db
        .deleteFrom('sub_domains')
        .where('domain_id', '=', domainId)
        .where('name', '=', subdomain)
        .executeTakeFirst();
      return Number(result.numDeletedRows ?? 0) > 0;
    },
  };
}
