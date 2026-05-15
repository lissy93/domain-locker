import { defineEventHandler } from 'h3';

const timeout = 5000;

export default defineEventHandler(async (event) => {
  event.node.res.setHeader(
    'Cache-Control',
    'public, max-age=900, stale-while-revalidate=30',
  );
  event.node.res.setHeader('Content-Type', 'application/json');
  event.node.res.setHeader('Access-Control-Allow-Origin', '*');
  event.node.res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  const authHeader = event.node.req.headers['Authorization'] as string | undefined;

  const [scheduledCrons, databaseStatus, supabaseStatus, uptimeStatus, ghActions] =
    await Promise.all([
      fetchHealthchecks(),
      fetchDatabaseHealth(authHeader),
      fetchSupabaseHealth(),
      fetchUptimeStatus(),
      fetchGitHubCIStatus(),
    ]);

  return { scheduledCrons, databaseStatus, supabaseStatus, uptimeStatus, ghActions };
});

async function fetchHealthchecks(): Promise<unknown[]> {
  const apiKey = import.meta.env['HEALTHCHECKS_API_KEY'];
  if (!apiKey) return [];
  try {
    const res = await fetch('https://healthchecks.io/api/v3/checks', {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { checks?: unknown[] };
    return body.checks || [];
  } catch (err) {
    console.error('[external-checks] Healthchecks error:', err);
    return [];
  }
}

async function fetchDatabaseHealth(authHeader?: string): Promise<unknown> {
  try {
    const url = `${import.meta.env['SUPABASE_URL']}/functions/v1/health`;
    const res = await fetch(url, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok ? (await res.json()) || { up: false } : { up: false };
  } catch (err) {
    console.error('[external-checks] Database health error:', err);
    return {};
  }
}

async function fetchSupabaseHealth(): Promise<{ healthy?: boolean } | undefined> {
  const anonKey = import.meta.env['SUPABASE_ANON_KEY'];
  if (!anonKey) return {};
  try {
    const res = await fetch(`${import.meta.env['SUPABASE_URL']}/health`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: AbortSignal.timeout(timeout),
    });
    const body = await res.text();
    return { healthy: body.trim() === 'Healthy' };
  } catch (err) {
    console.error('[external-checks] Supabase health error:', err);
    return { healthy: false };
  }
}

async function fetchUptimeStatus(): Promise<unknown | undefined> {
  const url = import.meta.env['UPTIME_KUMA_URL'];
  try {
    if (!url) throw new Error('UPTIME_KUMA_URL is not set');
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok ? await res.json() : undefined;
  } catch (err) {
    console.error('[external-checks] Uptime error:', err);
    return {};
  }
}

async function fetchGitHubCIStatus(): Promise<unknown | undefined> {
  const url = 'https://gh-workflows.as93.workers.dev/?user=lissy93&repo=domain-locker';
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok ? await res.json() : undefined;
  } catch (err) {
    console.error('[external-checks] github actions error:', err);
    return {};
  }
}
