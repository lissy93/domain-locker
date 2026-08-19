import type { Kysely } from 'kysely';
import type { Database } from '../schema';
import { currentUserId, toNumber } from './helpers';

export interface HistoryEntry {
  date: string;
  added: number;
  removed: number;
  updated: number;
}

export function historyRepo(db: Kysely<Database>) {
  function updatesFor(userId: string, domainName?: string) {
    const query = db
      .selectFrom('domain_updates')
      .innerJoin('domains', 'domains.id', 'domain_updates.domain_id')
      .where('domains.user_id', '=', userId);
    return domainName ? query.where('domains.domain_name', '=', domainName) : query;
  }

  return {
    /** Change counts per calendar day, bucketed in the app so both dialects agree */
    async changesByDay(
      days = 7,
      domainName?: string,
      userId = currentUserId(),
    ): Promise<HistoryEntry[]> {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const rows = await updatesFor(userId, domainName)
        .where('domain_updates.date', '>=', since)
        .select(['domain_updates.change_type', 'domain_updates.date'])
        .execute();

      const byDay = new Map<string, HistoryEntry>();
      for (const row of rows) {
        const date = row.date.slice(0, 10);
        const entry = byDay.get(date) ?? { date, added: 0, removed: 0, updated: 0 };
        if (row.change_type === 'added') entry.added += 1;
        else if (row.change_type === 'removed') entry.removed += 1;
        else entry.updated += 1;
        byDay.set(date, entry);
      }
      return [...byDay.values()].sort((left, right) =>
        left.date.localeCompare(right.date),
      );
    },

    async totalCount(domainName?: string, userId = currentUserId()): Promise<number> {
      const row = await updatesFor(userId, domainName)
        .select((eb) => eb.fn.countAll().as('total'))
        .executeTakeFirst();
      return toNumber(row?.total) ?? 0;
    },

    async list(
      { limit = 25, offset = 0, domainName }: ListOptions = {},
      userId = currentUserId(),
    ) {
      return updatesFor(userId, domainName)
        .select([
          'domain_updates.id',
          'domain_updates.domain_id',
          'domain_updates.change',
          'domain_updates.change_type',
          'domain_updates.old_value',
          'domain_updates.new_value',
          'domain_updates.date',
          'domains.domain_name',
        ])
        .orderBy('domain_updates.date', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();
    },

    /** Records a change against the domain's owner, never a hardcoded user */
    async record(
      domainId: string,
      change: {
        change: string;
        change_type: string;
        old_value?: string | null;
        new_value?: string | null;
      },
    ): Promise<boolean> {
      const owner = await db
        .selectFrom('domains')
        .where('id', '=', domainId)
        .select('user_id')
        .executeTakeFirst();
      if (!owner?.user_id) return false;

      await db
        .insertInto('domain_updates')
        .values({
          domain_id: domainId,
          user_id: owner.user_id,
          change: change.change,
          change_type: change.change_type,
          old_value: change.old_value ?? null,
          new_value: change.new_value ?? null,
        })
        .execute();
      return true;
    },
  };
}

interface ListOptions {
  limit?: number;
  offset?: number;
  domainName?: string;
}
