import { sql, type Kysely } from 'kysely';
import { TABLE_NAMES, type Database } from '../schema';
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

export function adminRepo(db: Kysely<Database>) {
  return {
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
