import { defineEventHandler } from 'h3';
import { endSession } from '../../../lib/auth';

export default defineEventHandler((event) => {
  endSession(event);
  return { authenticated: false };
});
