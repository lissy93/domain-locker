import { defineEventHandler } from 'h3';

/**
 * Healthcheck endpoint. Used by Docker
 * Returns a 200 status because if you get a response the server is alive
 */
export default defineEventHandler(() => {
  return { status: 'ok', message: "Houston, We're still alive 💗." };
});
