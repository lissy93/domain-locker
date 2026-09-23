// Loose-match registrar names, ignoring case, punctuation and any trailing [Tag] suffix
export function normalizeRegistrarName(input: string | null | undefined): string {
  return (input || '')
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s,.-]+/g, '');
}

// Pick a stable display name per group of variants (longest wins, then alphabetical)
function canonicalRegistrarNames(names: string[]): Map<string, string> {
  const canonical = new Map<string, string>();
  for (const name of names) {
    const key = normalizeRegistrarName(name);
    const current = canonical.get(key);
    if (
      !current ||
      name.length > current.length ||
      (name.length === current.length && name < current)
    ) {
      canonical.set(key, name);
    }
  }
  return canonical;
}

// Rows whose names loose-match the given registrar name
export function matchRegistrarRows<T extends { name: string }>(
  rows: T[],
  target: string,
): T[] {
  const targetName = normalizeRegistrarName(target);
  return rows.filter((row) => normalizeRegistrarName(row.name) === targetName);
}

// Collapse name variants to one row per registrar, backfilling url from variants
export function dedupeRegistrars<T extends { name: string; url?: string | null }>(
  rows: T[],
): T[] {
  const canonical = canonicalRegistrarNames(rows.map((row) => row.name));
  return rows
    .filter((row) => canonical.get(normalizeRegistrarName(row.name)) === row.name)
    .map((kept) => {
      if (kept.url) return kept;
      const withUrl = matchRegistrarRows(rows, kept.name).find((row) => row.url);
      return withUrl ? { ...kept, url: withUrl.url } : kept;
    });
}

// Sum domain counts across name variants, keyed by the canonical name
export function mergeRegistrarCounts(
  counts: Record<string, number>,
  allNames: string[] = Object.keys(counts),
): Record<string, number> {
  const canonical = canonicalRegistrarNames(allNames);
  const merged: Record<string, number> = {};
  for (const [name, count] of Object.entries(counts)) {
    if (!count) continue;
    const display = canonical.get(normalizeRegistrarName(name)) || name;
    merged[display] = (merged[display] || 0) + count;
  }
  return merged;
}
