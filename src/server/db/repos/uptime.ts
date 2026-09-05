import { sql, type Kysely } from 'kysely';
import type { Backend } from '../client';
import type { Database } from '../schema';
import { currentUserId, groupBy, toBoolean, toNumber } from './helpers';

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

/** UTC midnight for an ISO timestamp, so aggregation never splits a day in two */
function dayStart(iso: string): string {
  return `${iso.slice(0, 10)}T00:00:00.000Z`;
}

/** Averages come back as fractional numerics, but the columns hold whole ms */
function rounded(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

const UPTIME_COLUMNS = [
  'uptime.checked_at',
  'uptime.is_up',
  'uptime.response_code',
  'uptime.response_time_ms',
  'uptime.dns_lookup_time_ms',
  'uptime.ssl_handshake_time_ms',
] as const;

/** Cap on rows returned, for instances where the cleanup job never ran */
const MAX_POINTS = 50_000;

type RawUptimeRow = Record<keyof UptimeRow, unknown>;

function toUptimeRow(row: RawUptimeRow): UptimeRow {
  return {
    checked_at: String(row.checked_at),
    is_up: toBoolean(row.is_up),
    response_code: toNumber(row.response_code),
    response_time_ms: toNumber(row.response_time_ms),
    dns_lookup_time_ms: toNumber(row.dns_lookup_time_ms),
    ssl_handshake_time_ms: toNumber(row.ssl_handshake_time_ms),
  };
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

  /** UTC day bucket, matching the ISO timestamps SQLite stores */
  const dayBucket =
    backend === 'postgres'
      ? sql<string>`to_char(uptime.checked_at at time zone 'UTC', 'YYYY-MM-DD')`
      : sql<string>`substr(uptime.checked_at, 1, 10)`;

  return {
    async history(
      domainId: string,
      timeframe: string,
      userId = currentUserId(),
    ): Promise<UptimeRow[]> {
      const rows = await since(timeframeCutoff(timeframe), domainId, userId)
        .select(UPTIME_COLUMNS)
        .orderBy('uptime.checked_at', 'desc')
        .limit(MAX_POINTS)
        .execute();

      return rows.reverse().map(toUptimeRow);
    },

    /** Daily averages, aggregated in the database to keep the response small */
    async daily(
      domainId: string,
      days: number,
      userId = currentUserId(),
    ): Promise<{ day: string; avg_response_time_ms: number | null }[]> {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const rows = await since(cutoff, domainId, userId)
        .select([
          dayBucket.as('day'),
          sql<number | null>`avg(uptime.response_time_ms)`.as('avg_response_time_ms'),
        ])
        .groupBy(dayBucket)
        .orderBy(dayBucket)
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
        .select(['uptime.domain_id', ...UPTIME_COLUMNS])
        .orderBy('uptime.checked_at', 'desc')
        .limit(MAX_POINTS)
        .execute();

      for (const row of rows.reverse()) {
        grouped[row.domain_id]?.push(toUptimeRow(row));
      }
      return grouped;
    },

    /** Latest check per domain, for the monitor list */
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
        .where((eb) =>
          eb(
            'uptime.checked_at',
            '=',
            eb
              .selectFrom('uptime as recent')
              .whereRef('recent.domain_id', '=', 'uptime.domain_id')
              .select(({ fn }) => fn.max('recent.checked_at').as('checked_at')),
          ),
        )
        .select(['uptime.domain_id', ...UPTIME_COLUMNS])
        .execute();

      for (const row of rows) {
        latest[row.domain_id] ??= toUptimeRow(row);
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

    /**
     * Collapses each day past the detail window into one averaged row per domain,
     * timed at noon UTC. Days already down to a single row are skipped, so repeat
     * runs stay cheap and storage settles at one row per domain per day
     */
    async aggregate(
      olderThanDays: number,
    ): Promise<{ averages: number; removed: number }> {
      const cutoff = dayStart(
        new Date(Date.now() - olderThanDays * 86_400_000).toISOString(),
      );
      const groups = await db
        .selectFrom('uptime')
        .where('uptime.checked_at', '<', cutoff)
        .select([
          'uptime.domain_id',
          dayBucket.as('day'),
          sql<number>`avg(case when uptime.is_up then 1.0 else 0.0 end)`.as('up_ratio'),
          sql<number | null>`avg(uptime.response_time_ms)`.as('response_time_ms'),
          sql<number | null>`avg(uptime.dns_lookup_time_ms)`.as('dns_lookup_time_ms'),
          sql<number | null>`avg(uptime.ssl_handshake_time_ms)`.as(
            'ssl_handshake_time_ms',
          ),
        ])
        .groupBy(['uptime.domain_id', dayBucket])
        .having((eb) => eb(eb.fn.countAll(), '>', 1))
        .execute();

      let removed = 0;
      // A day at a time, so each statement stays bounded however big the backlog
      for (const [day, forDay] of groupBy(groups, 'day')) {
        const start = `${day}T00:00:00.000Z`;
        const end = new Date(Date.parse(start) + 86_400_000).toISOString();
        await db.transaction().execute(async (trx) => {
          const deleted = await trx
            .deleteFrom('uptime')
            .where(
              'domain_id',
              'in',
              forDay.map((group) => group.domain_id),
            )
            .where('checked_at', '>=', start)
            .where('checked_at', '<', end)
            .executeTakeFirst();
          await trx
            .insertInto('uptime')
            .values(
              forDay.map((group) => ({
                domain_id: group.domain_id,
                checked_at: `${day}T12:00:00.000Z`,
                is_up: Number(group.up_ratio) > 0.5,
                response_code: null,
                response_time_ms: rounded(group.response_time_ms),
                dns_lookup_time_ms: rounded(group.dns_lookup_time_ms),
                ssl_handshake_time_ms: rounded(group.ssl_handshake_time_ms),
              })),
            )
            .execute();
          removed += Number(deleted.numDeletedRows ?? 0);
        });
      }
      return { averages: groups.length, removed };
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
