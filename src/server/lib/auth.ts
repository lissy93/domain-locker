import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie, deleteCookie, getRequestHeader, type H3Event } from 'h3';
import { apiError } from './errors';

const SESSION_COOKIE = 'dl_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Optional: self-hosted instances stay open unless a password is configured */
export function authPassword(): string | null {
  return process.env['DL_AUTH_PASSWORD'] || null;
}

export function isAuthEnabled(): boolean {
  return Boolean(authPassword());
}

/**
 * Signing key for session cookies. Derived from the password when no explicit
 * secret is set, so sessions survive restarts without extra configuration.
 */
function signingSecret(): string {
  return process.env['DL_AUTH_SECRET'] || `dl:${authPassword() ?? ''}`;
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(candidate: string): boolean {
  const expected = authPassword();
  return Boolean(expected) && safeEquals(candidate, expected as string);
}

export function startSession(event: H3Event): void {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}.${randomBytes(12).toString('base64url')}`;
  setCookie(event, SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: getRequestHeader(event, 'x-forwarded-proto') === 'https',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function endSession(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' });
}

export function hasValidSession(event: H3Event): boolean {
  const cookie = getCookie(event, SESSION_COOKIE);
  if (!cookie) return false;

  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const [expiresAt, nonce, signature] = parts;
  if (!safeEquals(signature, sign(`${expiresAt}.${nonce}`))) return false;
  return Number(expiresAt) > Date.now();
}

/** Shared secret letting schedulers call job routes without a browser session */
function apiKey(): string | null {
  return process.env['DL_API_KEY'] || null;
}

export function hasValidApiKey(event: H3Event): boolean {
  const expected = apiKey();
  if (!expected) return false;
  const header =
    getRequestHeader(event, 'x-api-key') ??
    getRequestHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(header) && safeEquals(header as string, expected);
}

/** Throws unless the caller may use the API. A no-op when auth is not configured */
export function requireAuth(event: H3Event): void {
  if (!isAuthEnabled()) return;
  if (hasValidSession(event) || hasValidApiKey(event)) return;
  throw apiError('unauthorized', 'Authentication required');
}

/** Job routes additionally accept an API key even when no password is set */
export function requireJobAuth(event: H3Event): void {
  if (hasValidApiKey(event)) return;
  requireAuth(event);
}
