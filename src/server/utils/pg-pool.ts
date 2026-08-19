import pkg from 'pg';

const { Pool, types } = pkg;

// Keep DATE columns as YYYY-MM-DD strings (avoid node-pg's local-midnight UTC day-shift)
types.setTypeParser(1082, (val) => val);

export interface PgCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const STATEMENT_TIMEOUT_MS = Number(process.env['DL_PG_STATEMENT_TIMEOUT'] || 15_000);

let sharedPool: pkg.Pool | null = null;

/** Credentials from the server environment, the only source the app trusts */
export function serverPgCredentials(): PgCredentials | null {
  const { DL_PG_HOST, DL_PG_PORT, DL_PG_USER, DL_PG_PASSWORD, DL_PG_NAME } = process.env;
  if (!DL_PG_HOST || !DL_PG_USER || !DL_PG_PASSWORD || !DL_PG_NAME) return null;
  return {
    host: DL_PG_HOST,
    port: Number(DL_PG_PORT || 5432),
    user: DL_PG_USER,
    password: DL_PG_PASSWORD,
    database: DL_PG_NAME,
  };
}

/** Long-lived pool for the configured database, created on first use */
export function getPgPool(): pkg.Pool | null {
  if (sharedPool) return sharedPool;
  const credentials = serverPgCredentials();
  if (!credentials) return null;
  sharedPool = createPool(credentials);
  return sharedPool;
}

export function createPool(credentials: PgCredentials): pkg.Pool {
  return new Pool({
    ...credentials,
    max: Number(process.env['DL_PG_POOL_SIZE'] || 10),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
}

export async function closePgPool(): Promise<void> {
  const pool = sharedPool;
  sharedPool = null;
  await pool?.end();
}
