import { getRequestHeader, type H3Event } from 'h3';

/**
 * Base URL for internal self-calls (pg-executer, domain-info)
 * Dev reuses the request host, prod uses localhost:<port>
 */
export function getInternalBaseUrl(event?: H3Event): string {
  const override = process.env['DL_INTERNAL_BASE_URL'];
  if (override) {
    return override;
  }

  if (event && process.env['NODE_ENV'] === 'development') {
    // reuse the host the request came in on (0.0.0.0 is a bind addr, not a connect target)
    const host = getRequestHeader(event, 'host')?.replace(/^0\.0\.0\.0/, '127.0.0.1');
    if (host) {
      return `http://${host}`;
    }
  }

  const port = process.env['NITRO_PORT'] || process.env['PORT'] || '3000';
  return `http://localhost:${port}`;
}
