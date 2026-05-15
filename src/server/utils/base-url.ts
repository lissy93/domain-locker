import { H3Event, getRequestHeader } from 'h3';

/**
 * Gets the base URL for the current request, with fallback to environment variable
 * Detects the protocol and host from request headers (supports reverse proxies)
 *
 * @param event - H3 event object from the request handler
 * @param fallback - Optional fallback URL (defaults to http://localhost:3000)
 * @returns The base URL (e.g., "http://localhost:5173" or "https://domain-locker.com")
 */
export function getBaseUrl(event: H3Event, fallback = 'http://localhost:3000'): string {
  // Check environment variable first
  const envBaseUrl = process.env['DL_BASE_URL'];
  if (envBaseUrl) {
    return envBaseUrl;
  }

  // Detect from request headers (supports reverse proxies)
  try {
    const forwardedProto = getRequestHeader(event, 'x-forwarded-proto');
    const forwardedHost = getRequestHeader(event, 'x-forwarded-host');
    const host = getRequestHeader(event, 'host');
    const forwardedSsl = getRequestHeader(event, 'x-forwarded-ssl');

    const protocol = forwardedProto || (forwardedSsl === 'on' ? 'https' : 'http');
    const hostname = forwardedHost || host;

    if (hostname) {
      return `${protocol}://${hostname}`;
    }
  } catch {
    // Fall through to fallback
  }

  return fallback;
}
