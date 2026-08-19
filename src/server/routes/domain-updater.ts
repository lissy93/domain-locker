import { defineJobRoute } from '../lib/job-route';
import { runUpdater } from '../jobs/updater';

/** Manual trigger, kept for the legacy updater container. Idempotent via the job lock */
export default defineJobRoute('domain-updater', runUpdater);
