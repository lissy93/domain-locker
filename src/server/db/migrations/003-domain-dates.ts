/**
 * registration_date and updated_date hold registry calendar dates, but Postgres
 * declared them timestamptz, which shifted them by the server's UTC offset and
 * made them serialise differently from SQLite. SQLite already stores plain text.
 */
export const POSTGRES_DOMAIN_DATES = [
  `ALTER TABLE "public"."domains"
     ALTER COLUMN registration_date TYPE date USING registration_date::date`,
  `ALTER TABLE "public"."domains"
     ALTER COLUMN updated_date TYPE date USING updated_date::date`,
];
