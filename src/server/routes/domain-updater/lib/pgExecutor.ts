export async function callPgExecutor<T>(
  endpoint: string,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, params }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`pgExecutor HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  if (!json || !Array.isArray(json.data)) {
    throw new Error('pgExecutor response missing data array');
  }

  return json.data;
}
