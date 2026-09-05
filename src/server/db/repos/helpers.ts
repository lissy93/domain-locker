/** Self-hosted has no auth provider, so every row belongs to this user */
export const SELF_HOSTED_USER_ID = 'a0000000-aaaa-42a0-a0a0-00a000000a69';

export function currentUserId(): string {
  return process.env['DL_USER_ID'] || SELF_HOSTED_USER_ID;
}

/** Groups rows by a foreign key, so related records can be stitched in one pass */
export function groupBy<T, K extends keyof T>(rows: T[], key: K): Map<T[K], T[]> {
  const grouped = new Map<T[K], T[]>();
  for (const row of rows) {
    const existing = grouped.get(row[key]);
    if (existing) existing.push(row);
    else grouped.set(row[key], [row]);
  }
  return grouped;
}

/** Index rows by a unique foreign key, for one-to-one relations */
export function indexBy<T, K extends keyof T>(rows: T[], key: K): Map<T[K], T> {
  return new Map(rows.map((row) => [row[key], row]));
}

/** Drops join keys and metadata the client has no use for */
export function omit(
  row: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
}

/** SQLite stores booleans as 0/1, so normalise whichever dialect produced the row */
export function toBoolean(value: unknown): boolean {
  return value === true || value === 1;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** sd_info is stored as JSON text but Postgres hands back a parsed value */
export function toJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}
