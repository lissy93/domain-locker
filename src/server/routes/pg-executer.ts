import { createError, defineEventHandler, readBody, sendError, type H3Event } from 'h3';
import pkg from 'pg';
const { Client } = pkg;

interface PgCredentials {
  host?: string;
  port?: string | number;
  user?: string;
  password?: string;
  database?: string;
}

function handleCors(event: H3Event) {
  const req = event.node.req;
  const res = event.node.res;
  const origin = req.headers['origin'] || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

async function getPostgresClient(credentials?: PgCredentials) {
  const host = credentials?.host || process.env['DL_PG_HOST'];
  const port = +(credentials?.port || process.env['DL_PG_PORT'] || '5432');
  const user = credentials?.user || process.env['DL_PG_USER'];
  const password = credentials?.password || process.env['DL_PG_PASSWORD'];
  const database = credentials?.database || process.env['DL_PG_NAME'];

  if (!host || !user || !password || !database) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing Postgres credentials',
    });
  }

  const client = new Client({ host, port, user, password, database });
  try {
    await client.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw createError({
      statusCode: 500,
      statusMessage: 'Unable to connect to Postgres',
      data: { error: msg },
    });
  }

  return client;
}

export default defineEventHandler(async (event) => {
  if (handleCors(event)) return;

  try {
    const body = await readBody(event);
    if (!body?.query) {
      return sendError(
        event,
        createError({ statusCode: 400, statusMessage: 'Missing query in request body' }),
      );
    }

    const { query, params, credentials } = body;

    const client = await getPostgresClient(credentials);

    try {
      const result = await client.query(query, params || []);
      return { data: result.rows };
    } catch (queryErr) {
      console.error('❌ Query execution error:', queryErr);
      const msg = queryErr instanceof Error ? queryErr.message : String(queryErr);
      return sendError(
        event,
        createError({
          statusCode: 500,
          statusMessage: 'Error executing query',
          data: { error: msg },
        }),
      );
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error('❌ Unexpected error in Postgres executer:', err);
    const e = err as {
      statusCode?: number;
      statusMessage?: string;
      data?: { error?: string };
      message?: string;
    };
    return sendError(
      event,
      createError({
        statusCode: e.statusCode || 500,
        statusMessage: e.statusMessage || 'Unexpected server error',
        data: { error: e.data?.error || e.message },
      }),
    );
  }
});
