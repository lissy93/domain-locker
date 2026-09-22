import { statSync } from 'node:fs';
import { sql, type Kysely } from 'kysely';
import { TABLE_NAMES, type Database } from '../schema';
import { sqlitePath, type Backend } from '../client';
import type { DatabaseInfo } from '../../../types/common';
import { currentUserId } from './helpers';

export interface TableCheck {
  table: string;
  count: number | null;
  success: boolean;
  error?: string;
}

/** Tables holding user data, in an order safe to delete without breaking foreign keys */
const DELETABLE_TABLES = [
  'domain_tags',
  'domain_hosts',
  'notifications',
  'notification_preferences',
  'ip_addresses',
  'ssl_certificates',
  'whois_info',
  'dns_records',
  'domain_costings',
  'domain_statuses',
  'domain_updates',
  'domain_links',
  'uptime',
  'sub_domains',
  'domains',
  'tags',
  'hosts',
  'registrars',
] as const;

export type DeletableTable = (typeof DELETABLE_TABLES)[number];

/** Size and modified time, or null when there is no such file */
function fileStats(path: string) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

export function adminRepo(db: Kysely<Database>, backend: Backend) {
  return {
    /** Engine and storage details, for the connection page */
    async databaseInfo(): Promise<DatabaseInfo> {
      const migration = await db
        .selectFrom('schema_migrations')
        .select('version')
        .orderBy('version', 'desc')
        .limit(1)
        .executeTakeFirst();
      const schemaVersion = migration?.version ?? null;

      if (backend === 'postgres') {
        const { rows } = await sql<{
          version: string;
          database: string;
          size: string;
        }>`SELECT current_setting('server_version') AS version,
                  current_database() AS database,
                  pg_database_size(current_database()) AS size`.execute(db);
        const info = rows[0];
        return {
          backend,
          schemaVersion,
          version: info.version,
          database: info.database,
          sizeBytes: Number(info.size),
        };
      }

      const { rows } = await sql<{
        version: string;
        journalMode: string;
        foreignKeys: number;
        busyTimeoutMs: number;
        pageSize: number;
        freelistCount: number;
      }>`SELECT sqlite_version() AS version,
                (SELECT journal_mode FROM pragma_journal_mode()) AS journalMode,
                (SELECT foreign_keys FROM pragma_foreign_keys()) AS foreignKeys,
                (SELECT timeout FROM pragma_busy_timeout()) AS busyTimeoutMs,
                (SELECT page_size FROM pragma_page_size()) AS pageSize,
                (SELECT freelist_count FROM pragma_freelist_count()) AS freelistCount`.execute(
        db,
      );

      const path = sqlitePath();
      const stats = fileStats(path);
      const wal = fileStats(`${path}-wal`);
      const pragma = rows[0];
      const written = Math.max(stats?.mtimeMs ?? 0, wal?.mtimeMs ?? 0);

      return {
        backend,
        schemaVersion,
        version: pragma.version,
        path,
        sizeBytes: stats?.size ?? null,
        walBytes: wal?.size ?? null,
        reclaimableBytes: pragma.pageSize * pragma.freelistCount,
        journalMode: pragma.journalMode,
        foreignKeys: Boolean(pragma.foreignKeys),
        busyTimeoutMs: pragma.busyTimeoutMs,
        lastModified: written ? new Date(written).toISOString() : null,
      };
    },

    /** Row count per table, reporting failures rather than throwing */
    async checkTables(): Promise<TableCheck[]> {
      return Promise.all(
        TABLE_NAMES.map(async (table) => {
          try {
            const { rows } = await sql<{
              total: number;
            }>`SELECT count(*) AS total FROM ${sql.table(table)}`.execute(db);
            return { table, count: Number(rows[0]?.total ?? 0), success: true };
          } catch (err) {
            return {
              table,
              count: null,
              success: false,
              error: (err as Error)?.message ?? 'Unknown error',
            };
          }
        }),
      );
    },

    /**
     * Deletes the user's data. Child tables are scoped through their domain,
     * so another user's rows are never touched.
     */
    async deleteAllData(
      tables: readonly DeletableTable[] = DELETABLE_TABLES,
      userId = currentUserId(),
    ): Promise<void> {
      const requested = new Set(tables);
      const ordered = DELETABLE_TABLES.filter((table) => requested.has(table));

      await db.transaction().execute(async (trx) => {
        const domainIds = (
          await trx
            .selectFrom('domains')
            .where('user_id', '=', userId)
            .select('id')
            .execute()
        ).map((domain) => domain.id);

        for (const table of ordered) {
          if (USER_SCOPED.has(table)) {
            await trx.deleteFrom(table).where('user_id', '=', userId).execute();
          } else if (domainIds.length) {
            await trx.deleteFrom(table).where('domain_id', 'in', domainIds).execute();
          }
        }
      });
    },

    deletableTables: DELETABLE_TABLES,
  };
}

const USER_SCOPED = new Set<DeletableTable>([
  'domains',
  'tags',
  'hosts',
  'registrars',
  'notifications',
]);
