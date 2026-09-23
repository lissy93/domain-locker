/** Basic auth header for `user:pass` credentials */
export function basicAuth(credentials: string): string {
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/** Move `user:pass@` out of a URL into a basic auth header, as fetch rejects it inline */
export function splitUrlCredentials(raw: string): { url: URL; auth: string | null } {
  const url = new URL(raw);
  if (!url.username && !url.password) return { url, auth: null };

  const auth = basicAuth(decodeURIComponent(`${url.username}:${url.password}`));
  url.username = '';
  url.password = '';
  return { url, auth };
}
