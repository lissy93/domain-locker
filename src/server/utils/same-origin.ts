import { getRequestHeader, type H3Event } from 'h3';

/**
 * Cross-site request guard. Requests carrying no Origin are server-to-server
 * (internal jobs, curl) and pass; browser requests must come from this instance,
 * so a page on another site cannot drive the API with the user's session.
 */
export function isSameOrigin(event: H3Event): boolean {
  const origin = getRequestHeader(event, 'origin');
  if (!origin) return true;

  const allowed = new Set<string>();
  for (const candidate of [
    process.env['DL_BASE_URL'],
    ...(process.env['DL_ALLOWED_ORIGINS'] || '').split(','),
  ]) {
    const normalised = normaliseOrigin(candidate);
    if (normalised) allowed.add(normalised);
  }

  const host = getRequestHeader(event, 'host');
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }

  return allowed.has(origin.toLowerCase().replace(/\/+$/, ''));
}

function normaliseOrigin(value?: string): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return null;
  }
}
