import { defineEventHandler } from 'h3';
import { hasValidSession, isAuthEnabled } from '../../../lib/auth';

// Unwrapped so the login page can ask whether a password is required
export default defineEventHandler((event) => ({
  authRequired: isAuthEnabled(),
  authenticated: !isAuthEnabled() || hasValidSession(event),
}));
