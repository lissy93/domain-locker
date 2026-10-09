import {
  defineEventHandler,
  setResponseHeader,
  setResponseStatus,
  type H3Event,
} from 'h3';
import { runJob, type JobName } from '../jobs/runner';
import { jobAuthMissing } from './auth';
import { STATUS_BY_CODE, type ApiErrorCode } from './errors';
import Logger from '../utils/logger';

const log = new Logger('jobs');
const warned = new Set<JobName>();

/** Sets the status and returns the same error envelope as the /v1 routes */
function fail(event: H3Event, code: ApiErrorCode, message: string) {
  setResponseStatus(event, STATUS_BY_CODE[code]);
  return { error: { code, message } };
}

/**
 * Manual trigger for a scheduled job, kept so the legacy updater container
 * keeps working. The job lock makes a duplicate trigger a no-op.
 */
export function defineJobRoute(job: JobName, work: () => Promise<unknown>) {
  return defineEventHandler(async (event) => {
    if (process.env['DL_ENV_TYPE'] !== 'selfHosted') {
      return fail(event, 'forbidden', 'Only available in self-hosted mode');
    }

    if (event.method !== 'POST') {
      setResponseHeader(event, 'Allow', 'POST');
      return fail(event, 'method_not_allowed', 'Only POST is allowed');
    }

    if (jobAuthMissing(event)) {
      return fail(event, 'unauthorized', 'Authentication required');
    }

    if (!warned.has(job) && process.env['DL_DISABLE_SCHEDULER'] !== 'true') {
      warned.add(job);
      log.info(
        `${job} was triggered externally, but the app already schedules it. ` +
          'The updater container can be removed, see 0.3.0 release notes',
      );
    }

    return runJob(job, work);
  });
}
