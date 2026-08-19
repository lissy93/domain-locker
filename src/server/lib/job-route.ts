import { defineEventHandler, setResponseStatus } from 'h3';
import { runJob, type JobName } from '../jobs/runner';
import { hasValidApiKey, isAuthEnabled, hasValidSession } from './auth';
import { STATUS_BY_CODE } from './errors';

/**
 * Manual trigger for a scheduled job, kept so the legacy updater container
 * keeps working. The job lock makes a duplicate trigger a no-op.
 */
export function defineJobRoute(job: JobName, work: () => Promise<unknown>) {
  return defineEventHandler(async (event) => {
    if (process.env['DL_ENV_TYPE'] !== 'selfHosted') {
      setResponseStatus(event, STATUS_BY_CODE['forbidden']);
      return {
        error: { code: 'forbidden', message: 'Only available in self-hosted mode' },
      };
    }

    if (isAuthEnabled() && !hasValidApiKey(event) && !hasValidSession(event)) {
      setResponseStatus(event, STATUS_BY_CODE['unauthorized']);
      return { error: { code: 'unauthorized', message: 'Authentication required' } };
    }

    return runJob(job, work);
  });
}
