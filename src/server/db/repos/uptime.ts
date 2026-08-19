import { sql, type Kysely } from 'kysely';
import type { Backend } from '../client';
import type { Database } from '../schema';
import { currentUserId, toBoolean, toNumber } from './helpers';

export interface UptimeRow {
  checked_at: string;
  is_up: boolean;
  response_code: number | null;
  response_time_ms: number | null;
  dns_lookup_time_ms: number | null;
  ssl_handshake_time_ms: number | null;
}

/** Timeframe labels the UI offers, expressed in hours */
const TIMEFRAME_HOURS: Record<string, number> = {
  hour: 1,
  day: 24,
  week: 24 * 7,
  month: 24 * 30,
  year: 24 * 365,
};

export function timeframeCutoff(timeframe: string, now = Date.now()): string {
  const hours = TIMEFRAME_HOURS[timeframe] ?? TIMEFRAME_HOURS['day'];
  return new Date(now - hours * 3_600_000).toISOString();
}

export function uptimeRepo(db: Kysely<Database>, backend: Backend) {
  /** Both dialects sort ISO-8601 UTC strings chronologically, so a plain compare works */
  function since(cutoff: string, domainId: string, userId: string) {
    return db
      .selectFrom('uptime')
      .innerJoin('domains', 'domains.id', 'uptime.domain_id')
      .where('domains.user_id', '=', userId)
      .where('uptime.domain_id', '=', domainId)
      .where('uptime.checked_at', '>=', cutoff);
  }

  return {
    async history(
      domainId: string,
      timeframe: string,
      userId = currentUserId(),
    ): Promise<UptimeRow[]> {
      const rows = await since(timeframeCutoff(timeframe), domainId, userId)
        .select([
          'uptime.checked_at',
          'uptime.is_up',
          'uptime.response_code',
          'uptime.response_time_ms',
          'uptime.dns_lookup_time_ms',
          'uptime.ssl_handshake_time_ms',
        ])
        .orderBy('uptime.checked_at')
        .execute();

      return rows.map((row) => ({
        checked_at: row.checked_at,
        is_up: toBoolean(row.is_up),
        response_code: toNumber(row.response_code),
        response_time_ms: toNumber(row.response_time_ms),
        dns_lookup_time_ms: toNumber(row.dns_lookup_time_ms),
        ssl_handshake_time_ms: toNumber(row.ssl_handshake_time_ms),
      }));
    },

    /** Daily averages, aggregated in the database to keep the response small */
    async daily(
      domainId: string,
      days: number,
      userId = currentUserId(),
    ): Promise<{ day: string; avg_response_time_ms: number | null }[]> {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      // Only the date extraction differs between dialects
      const day =
        backend === 'postgres'
          ? sql<string>`to_char(date_trunc('day', uptime.checked_at), 'YYYY-MM-DD')`
          : sql<string>`substr(uptime.checked_at, 1, 10)`;

      const rows = await since(cutoff, domainId, userId)
        .select([
          day.as('day'),
          sql<number | null>`avg(uptime.response_time_ms)`.as('avg_response_time_ms'),
        ])
        .groupBy(day)
        .orderBy(day)
        .execute();

      return rows.map((row) => ({
        day: row.day,
        avg_response_time_ms: toNumber(row.avg_response_time_ms),
      }));
    },

    /** History for many domains at once, so the monitor page makes one request */
    async historyFor(
      domainIds: string[],
      timeframe: string,
      userId = currentUserId(),
    ): Promise<Record<string, UptimeRow[]>> {
      const grouped = Object.fromEntries(domainIds.map((id) => [id, []])) as Record<
        string,
        UptimeRow[]
      >;
      if (!domainIds.length) return grouped;

      const rows = await db
        .selectFrom('uptime')
        .innerJoin('domains', 'domains.id', 'uptime.domain_id')
        .where('domains.user_id', '=', userId)
        .where('uptime.domain_id', 'in', domainIds)
        .where('uptime.checked_at', '>=', timeframeCutoff(timeframe))
        .select([
          'uptime.domain_id',
          'uptime.checked_at',
          'uptime.is_up',
          'uptime.response_code',
          'uptime.response_time_ms',
          'uptime.dns_lookup_time_ms',
          'uptime.ssl_handshake_time_ms',
        ])
        .orderBy('uptime.checked_at')
        .execute();

      for (const row of rows) {
        grouped[row.domain_id]?.push({
          checked_at: row.checked_at,
          is_up: toBoolean(row.is_up),
          response_code: toNumber(row.response_code),
          response_time_ms: toNumber(row.response_time_ms),
          dns_lookup_time_ms: toNumber(row.dns_lookup_time_ms),
          ssl_handshake_time_ms: toNumber(row.ssl_handshake_time_ms),
        });
      }
      return grouped;
    },

    /** Latest check for each of the given domains, for the monitor list */
    async latestFor(
      domainIds: string[],
      userId = currentUserId(),
    ): Promise<Record<string, UptimeRow | null>> {
      const latest = Object.fromEntries(domainIds.map((id) => [id, null])) as Record<
        string,
        UptimeRow | null
      >;
      if (!domainIds.length) return latest;

      const rows = await db
        .selectFrom('uptime')
        .innerJoin('domains', 'domains.id', 'uptime.domain_id')
        .where('domains.user_id', '=', userId)
        .where('uptime.domain_id', 'in', domainIds)
        .select([
          'uptime.domain_id',
          'uptime.checked_at',
          'uptime.is_up',
          'uptime.response_code',
          'uptime.response_time_ms',
          'uptime.dns_lookup_time_ms',
          'uptime.ssl_handshake_time_ms',
        ])
        .orderBy('uptime.checked_at', 'desc')
        .execute();

      for (const row of rows) {
        if (latest[row.domain_id]) continue;
        latest[row.domain_id] = {
          checked_at: row.checked_at,
          is_up: toBoolean(row.is_up),
          response_code: toNumber(row.response_code),
          response_time_ms: toNumber(row.response_time_ms),
          dns_lookup_time_ms: toNumber(row.dns_lookup_time_ms),
          ssl_handshake_time_ms: toNumber(row.ssl_handshake_time_ms),
        };
      }
      return latest;
    },

    async record(
      domainId: string,
      check: Omit<UptimeRow, 'checked_at'> & { checked_at?: string },
    ): Promise<void> {
      await db
        .insertInto('uptime')
        .values({
          domain_id: domainId,
          checked_at: check.checked_at ?? new Date().toISOString(),
          is_up: check.is_up,
          response_code: check.response_code,
          response_time_ms: check.response_time_ms,
          dns_lookup_time_ms: check.dns_lookup_time_ms,
          ssl_handshake_time_ms: check.ssl_handshake_time_ms,
        })
        .execute();
    },

    /** Drops checks older than the retention window */
    async prune(olderThanDays: number): Promise<number> {
      const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
      const result = await db
        .deleteFrom('uptime')
        .where('checked_at', '<', cutoff)
        .executeTakeFirst();
      return Number(result.numDeletedRows ?? 0);
    },
  };
}
