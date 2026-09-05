/**
 * Read number from an env var
 */
export function numberFromEnv(
  name: string,
  fallback: number,
  { min = 0 }: { min?: number } = {},
): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min ? value : fallback;
}
