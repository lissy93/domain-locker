import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { checkPassword, isAuthEnabled, startSession } from '../../../lib/auth';
import { STATUS_BY_CODE } from '../../../lib/errors';
import { isSameOrigin } from '../../../utils/same-origin';

export default defineEventHandler(async (event) => {
  if (!isSameOrigin(event)) {
    return deny(event, 'forbidden', 'Cross-origin requests are not allowed');
  }
  if (!isAuthEnabled()) return { authenticated: true };

  const body = await readBody(event).catch(() => undefined);
  if (typeof body?.password !== 'string' || !checkPassword(body.password)) {
    return deny(event, 'unauthorized', 'Incorrect password');
  }

  startSession(event);
  return { authenticated: true };
});

function deny(
  event: Parameters<typeof setResponseStatus>[0],
  code: 'forbidden' | 'unauthorized',
  message: string,
) {
  setResponseStatus(event, STATUS_BY_CODE[code]);
  return { error: { code, message } };
}
