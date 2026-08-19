import { createError, defineEventHandler, readBody, sendError } from 'h3';
import { createPool, getPgPool, type PgCredentials } from '../utils/pg-pool';
import { isSameOrigin } from '../utils/same-origin';
import Logger from '../utils/logger';

const logger = new Logger('pg-executer');

/**
 * Runs a parameterised query against the configured Postgres database.
 * Superseded by /api/v1 and kept only while the legacy client data layer exists.
 */

// Opt-in escape hatch for instances still configuring the database from the browser
const allowsClientCredentials = () =>
  process.env['DL_ALLOW_CLIENT_DB_CREDENTIALS'] === 'true';

const clientPools = new Map<string, ReturnType<typeof createPool>>();
let warnedAboutClientCredentials = false;

export default defineEventHandler(async (event) => {
  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    event.node.res.end();
    return;
  }

  if (!isSameOrigin(event)) {
    return sendError(
      event,
      createError({
        statusCode: 403,
        statusMessage: 'Cross-origin requests are not allowed',
      }),
    );
  }

  const body = await readBody(event);
  if (!body?.query || typeof body.query !== 'string') {
    return sendError(
      event,
      createError({ statusCode: 400, statusMessage: 'Missing query in request body' }),
    );
  }

  const pool = resolvePool(body.credentials);
  if (!pool) {
    return sendError(
      event,
      createError({ statusCode: 500, statusMessage: 'Postgres is not configured' }),
    );
  }

  try {
    const result = await pool.query(body.query, body.params || []);
    return { data: result.rows };
  } catch (err) {
    logger.error(`Query execution failed: ${(err as Error)?.message}`);
    return sendError(
      event,
      createError({ statusCode: 500, statusMessage: 'Error executing query' }),
    );
  }
});

/** Server credentials by default; browser-supplied ones only behind the escape hatch */
function resolvePool(credentials?: Partial<PgCredentials>) {
  if (!credentials || !allowsClientCredentials()) return getPgPool();

  const { host, port, user, password, database } = credentials;
  if (!host || !user || !password || !database) return getPgPool();

  if (!warnedAboutClientCredentials) {
    warnedAboutClientCredentials = true;
    logger.warn(
      'DL_ALLOW_CLIENT_DB_CREDENTIALS is enabled. Browser-supplied database ' +
        'credentials are deprecated and will be removed in a future release.',
    );
  }

  const resolved = { host, port: Number(port || 5432), user, password, database };
  const key = `${resolved.user}@${resolved.host}:${resolved.port}/${resolved.database}`;
  let pool = clientPools.get(key);
  if (!pool) {
    pool = createPool(resolved);
    clientPools.set(key, pool);
  }
  return pool;
}
