import { CompiledQuery } from 'kysely';
import { currentBackend, getDb } from './client';
import { ensureMigrated } from './ready';

/**
 * Runs a parameterised statement against the configured database, in process.
 * Used by the scheduled jobs, which still hold hand-written SQL; Phase 3 moves
 * them onto the repositories.
 */
export async function runQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureMigrated();
  const statement =
    currentBackend() === 'sqlite'
      ? toSqlitePlaceholders(query, params)
      : { query, params };

  const result = await getDb().executeQuery<T>(
    CompiledQuery.raw(statement.query, statement.params),
  );
  return result.rows;
}

/** Rewrites $1-style placeholders to SQLite's positional ?, repeats included */
function toSqlitePlaceholders(query: string, params: unknown[]) {
  const ordered: unknown[] = [];
  const rewritten = query.replace(/\$(\d+)/g, (_, index: string) => {
    ordered.push(params[Number(index) - 1]);
    return '?';
  });
  return { query: rewritten, params: ordered };
}
