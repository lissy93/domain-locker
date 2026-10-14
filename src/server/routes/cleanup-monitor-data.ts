import { defineJobRoute } from '../lib/job-route';
import { runCleanup } from '../jobs/cleanup';

export default defineJobRoute('cleanup-monitor-data', runCleanup);
