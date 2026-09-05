import { CompiledQuery } from 'kysely';
import { currentBackend, getDb } from './client';
import { ensureMigrated } from './ready';

/** Runs a parameterised statement in process, for the updater's hand-written SQL */
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

/** Consumes quoted literals first, so a $1 inside one is left alone */
const PLACEHOLDER = /'(?:[^']|'')*'|\$(\d+)/g;

/** Rewrites $1-style placeholders to SQLite's positional ?, repeats included */
function toSqlitePlaceholders(query: string, params: unknown[]) {
  const ordered: unknown[] = [];
  const rewritten = query.replace(PLACEHOLDER, (match, index?: string) => {
    if (index === undefined) return match;
    const position = Number(index);
    if (position < 1 || position > params.length) {
      throw new Error(`Query references $${position} but got ${params.length} params`);
    }
    ordered.push(params[position - 1]);
    return '?';
  });
  return { query: rewritten, params: ordered };
}
