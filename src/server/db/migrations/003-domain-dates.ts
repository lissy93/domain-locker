/**
 * registration_date and updated_date hold registry calendar dates, but Postgres
 * declared them timestamptz, which shifted them by the server's UTC offset and
 * made them serialise differently from SQLite. SQLite already stores plain text.
 */

/** Converts as UTC, and only while the column is still a timestamptz */
const toUtcDate = (column: string) => `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'domains'
       AND column_name = '${column}' AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE "public"."domains"
      ALTER COLUMN ${column} TYPE date USING (${column} AT TIME ZONE 'UTC')::date;
  END IF;
END $$`;

export const POSTGRES_DOMAIN_DATES = [
  toUtcDate('registration_date'),
  toUtcDate('updated_date'),
];
