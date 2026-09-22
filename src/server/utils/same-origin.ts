import { getRequestHeader, type H3Event } from 'h3';
import Logger from './logger';

const log = new Logger('same-origin');
let hintLogged = false;

/**
 * Cross-site request guard. Requests carrying no Origin are server-to-server
 * (internal jobs, curl) and pass; browser requests must come from this instance,
 * so a page on another site cannot drive the API with the user's session.
 */
export function isSameOrigin(event: H3Event): boolean {
  const origin = getRequestHeader(event, 'origin');
  if (!origin) return true;

  // Browsers send this on every request and a page cannot forge a Sec- header,
  // so it settles the question without a proxy having to forward Host intact
  if (getRequestHeader(event, 'sec-fetch-site') === 'same-origin') return true;

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

  if (allowed.has(origin.toLowerCase().replace(/\/+$/, ''))) return true;

  if (!hintLogged) {
    hintLogged = true;
    log.warn(
      `Rejected a cross-origin request from ${origin}. ` +
        'If that is your own address, set DL_BASE_URL to it (or DL_ALLOWED_ORIGINS for several)',
    );
  }
  return false;
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
