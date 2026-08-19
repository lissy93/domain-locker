import type { Kysely } from 'kysely';
import type { Database } from '../schema';
import { currentUserId, toNumber } from './helpers';
import { linkTags } from './domain-write';

export interface TagInput {
  name: string;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
}

export function tagsRepo(db: Kysely<Database>) {
  return {
    async list(userId = currentUserId()) {
      return db
        .selectFrom('tags')
        .where('user_id', '=', userId)
        .selectAll()
        .orderBy('name')
        .execute();
    },

    async getByName(name: string, userId = currentUserId()) {
      return (
        (await db
          .selectFrom('tags')
          .where('user_id', '=', userId)
          .where('name', '=', name)
          .selectAll()
          .executeTakeFirst()) ?? null
      );
    },

    async create(tag: TagInput, userId = currentUserId()) {
      return db
        .insertInto('tags')
        .values({
          name: tag.name,
          color: tag.color ?? null,
          icon: tag.icon ?? null,
          description: tag.description ?? null,
          user_id: userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    /** Updates by id so a tag can be renamed */
    async update(id: string, tag: TagInput, userId = currentUserId()) {
      return (
        (await db
          .updateTable('tags')
          .set({
            name: tag.name,
            color: tag.color ?? null,
            icon: tag.icon ?? null,
            description: tag.description ?? null,
          })
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .returningAll()
          .executeTakeFirst()) ?? null
      );
    },

    async remove(id: string, userId = currentUserId()): Promise<boolean> {
      const result = await db
        .deleteFrom('tags')
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();
      return Number(result.numDeletedRows ?? 0) > 0;
    },

    async withDomainCounts(userId = currentUserId()) {
      const rows = await db
        .selectFrom('tags')
        .leftJoin('domain_tags', 'domain_tags.tag_id', 'tags.id')
        .where('tags.user_id', '=', userId)
        .groupBy(['tags.id', 'tags.name', 'tags.color', 'tags.icon', 'tags.description'])
        .select((eb) => [
          'tags.id',
          'tags.name',
          'tags.color',
          'tags.icon',
          'tags.description',
          eb.fn.count('domain_tags.domain_id').as('domain_count'),
        ])
        .orderBy('tags.name')
        .execute();
      return rows.map((row) => ({
        ...row,
        domain_count: toNumber(row.domain_count) ?? 0,
      }));
    },

    async domainCounts(userId = currentUserId()): Promise<Record<string, number>> {
      const rows = await this.withDomainCounts(userId);
      return Object.fromEntries(rows.map((row) => [row.name, row.domain_count]));
    },

    /** Domains currently carrying the tag, alongside every domain to choose from */
    async domainsForTag(tagId: string, userId = currentUserId()) {
      const [available, selected] = await Promise.all([
        db
          .selectFrom('domains')
          .where('user_id', '=', userId)
          .select(['id', 'domain_name'])
          .orderBy('domain_name')
          .execute(),
        db
          .selectFrom('domain_tags')
          .innerJoin('domains', 'domains.id', 'domain_tags.domain_id')
          .where('domain_tags.tag_id', '=', tagId)
          .where('domains.user_id', '=', userId)
          .select(['domains.id', 'domains.domain_name'])
          .orderBy('domains.domain_name')
          .execute(),
      ]);
      return { available, selected };
    },

    /** Makes the tag's domain list exactly the one given */
    async setDomainsForTag(
      tagId: string,
      domainIds: string[],
      userId = currentUserId(),
    ): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('domain_tags').where('tag_id', '=', tagId).execute();
        if (!domainIds.length) return;

        const owned = await trx
          .selectFrom('domains')
          .where('user_id', '=', userId)
          .where('id', 'in', domainIds)
          .select('id')
          .execute();
        if (!owned.length) return;

        await trx
          .insertInto('domain_tags')
          .values(owned.map((domain) => ({ domain_id: domain.id, tag_id: tagId })))
          .execute();
      });
    },

    /** Replaces a domain's tags, creating any that do not exist yet */
    async setTagsForDomain(
      domainId: string,
      tagNames: string[],
      userId = currentUserId(),
    ): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('domain_tags').where('domain_id', '=', domainId).execute();
        await linkTags(trx, domainId, tagNames, userId);
      });
    },
  };
}
