import {
  defineEventHandler,
  getQuery,
  getRouterParam,
  readBody,
  setResponseStatus,
  type H3Event,
} from 'h3';
import type { ZodType } from 'zod';
import { repos, type Repos } from '../db/repos';
import { ensureMigrated } from '../db/ready';
import { isSameOrigin } from '../utils/same-origin';
import Logger from '../utils/logger';
import { requireAuth } from './auth';
import { ApiError, type ApiErrorCode, STATUS_BY_CODE } from './errors';

const log = new Logger('api');

export interface ApiContext<Body, Query> {
  event: H3Event;
  db: Repos;
  body: Body;
  query: Query;
  param: (name: string) => string;
  /** For id segments, so a malformed one is a bad request rather than a driver error */
  uuidParam: (name: string) => string;
}

interface RouteOptions<Body, Query> {
  /** Rejected when the instance is running read-only (demo mode) */
  write?: boolean;
  body?: ZodType<Body>;
  query?: ZodType<Query>;
}

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

const isReadOnly = () => process.env['DL_DISABLE_WRITE_METHODS'] === 'true';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Wraps a route with the concerns every endpoint shares: origin and auth
 * checks, input validation, and a single error envelope. Failures are returned
 * rather than thrown, so the response shape survives Nitro's error handling.
 */
export function defineApiRoute<Result, Body = undefined, Query = undefined>(
  options: RouteOptions<Body, Query>,
  handle: (context: ApiContext<Body, Query>) => Promise<Result> | Result,
) {
  return defineEventHandler(async (event): Promise<Result | ApiErrorBody> => {
    try {
      // Managed instances serve their data through Supabase, never from here
      if (process.env['DL_ENV_TYPE'] === 'managed') {
        throw new ApiError(
          'forbidden',
          'This API is only served by self-hosted instances',
        );
      }
      if (!isSameOrigin(event)) {
        throw new ApiError('forbidden', 'Cross-origin requests are not allowed');
      }
      requireAuth(event);

      if (options.write && isReadOnly()) {
        throw new ApiError('read_only', 'This instance is running in read-only mode');
      }

      const body = options.body
        ? parse(options.body, await readBody(event).catch(() => undefined), 'body')
        : (undefined as Body);
      const query = options.query
        ? parse(options.query, getQuery(event), 'query')
        : (undefined as Query);

      const param = (name: string) => {
        const value = getRouterParam(event, name);
        if (!value) throw new ApiError('bad_request', `Missing route parameter: ${name}`);
        return decodeURIComponent(value);
      };

      await ensureMigrated();
      return await handle({
        event,
        db: repos(),
        body,
        query,
        param,
        uuidParam: (name) => {
          const value = param(name);
          if (!UUID_PATTERN.test(value)) {
            throw new ApiError('bad_request', `Route parameter is not an id: ${name}`);
          }
          return value;
        },
      });
    } catch (err) {
      return respondWithError(event, err);
    }
  });
}

function parse<T>(schema: ZodType<T>, input: unknown, source: 'body' | 'query'): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ApiError(
    'bad_request',
    `Invalid request ${source}`,
    result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  );
}

/** Known failures keep their code and message; anything else is masked */
function respondWithError(event: H3Event, err: unknown): ApiErrorBody {
  if (err instanceof ApiError) {
    setResponseStatus(event, STATUS_BY_CODE[err.code]);
    return {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    };
  }

  log.error(`Unhandled route error: ${(err as Error)?.message ?? String(err)}`);
  setResponseStatus(event, 500);
  return {
    error: { code: 'internal', message: 'Something went wrong handling that request' },
  };
}
