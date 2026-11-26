/** Per-domain archiving, plus switches to pause uptime monitoring and auto updates */

/** Adds a column to domains, skipping it when it's already there */
const addDomainColumn = (column: string, definition: string) => `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'domains'
       AND column_name = '${column}'
  ) THEN
    ALTER TABLE "public"."domains" ADD COLUMN ${column} ${definition};
  END IF;
END $$`;

export const POSTGRES_DOMAIN_TRACKING = [
  addDomainColumn('archived_at', 'timestamp with time zone'),
  addDomainColumn('monitor_enabled', 'boolean NOT NULL DEFAULT true'),
  addDomainColumn('updates_enabled', 'boolean NOT NULL DEFAULT true'),
];

export const SQLITE_DOMAIN_TRACKING = [
  'ALTER TABLE domains ADD COLUMN archived_at TEXT',
  'ALTER TABLE domains ADD COLUMN monitor_enabled INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE domains ADD COLUMN updates_enabled INTEGER NOT NULL DEFAULT 1',
];
