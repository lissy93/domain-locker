export function getEnvVar(name: string, fallback?: string): string {
  const val = process.env[name] || (import.meta.env && import.meta.env[name]);
  if (!val && fallback === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val || fallback!;
}

export function normalizeStr(input: string | null | undefined): string {
  return (input || '').trim().toLowerCase();
}

export function removeUrlChars(input: string | null | undefined): string {
  return (input || '').trim().replace(/[/\\?#%]/g, '');
}

export function normalizeDate(input: string | null | undefined): string {
  if (!input) return '';
  const date = new Date(input);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

export function toDateOnly(input: string | number | null | undefined): string {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function datesDifferBeyondThreshold(a?: string, b?: string, days = 1): boolean {
  if (!a || !b) return false;
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return true;
  const diff = Math.abs(dateA.getTime() - dateB.getTime());
  return diff > days * 86400 * 1000;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}
