export const FETCH_TIMEOUT_MS = 8000;

// Fetch JSON identifying as domain-locker, with a timeout, throwing on non-2xx
export const fetchJson = async <T>(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<T> => {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'domain-locker', Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
};
