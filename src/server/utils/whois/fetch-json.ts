export const FETCH_TIMEOUT_MS = 8000;

/** Time a request may take: the cap, or what remains, never 0 which would mean no limit */
export const timeLeft = (deadline: number): number =>
  Math.max(1, Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()));

// Fetch JSON identifying as domain-locker, giving up at the deadline, throwing on non-2xx
export const fetchJson = async <T>(url: string, deadline: number): Promise<T> => {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'domain-locker', Accept: 'application/json' },
    signal: AbortSignal.timeout(timeLeft(deadline)),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
};
