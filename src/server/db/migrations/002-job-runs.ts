/**
 * Tracks the last run of each scheduled job. Doubles as a lock, so a legacy
 * updater container curling the old routes cannot duplicate work the internal
 * scheduler is already doing.
 */
export const POSTGRES_JOB_RUNS = [
  `CREATE TABLE IF NOT EXISTS "public"."job_runs" (
     name text NOT NULL,
     started_at timestamp with time zone,
     finished_at timestamp with time zone,
     status text,
     detail text,
     CONSTRAINT job_runs_pkey PRIMARY KEY (name)
   )`,
];

export const SQLITE_JOB_RUNS = [
  `CREATE TABLE IF NOT EXISTS job_runs (
     name TEXT PRIMARY KEY,
     started_at TEXT,
     finished_at TEXT,
     status TEXT,
     detail TEXT
   )`,
];
