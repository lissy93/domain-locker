import { defineJobRoute } from '../lib/job-route';
import { runUptimeCleanup } from '../jobs/monitor';

export default defineJobRoute('cleanup-monitor-data', runUptimeCleanup);
