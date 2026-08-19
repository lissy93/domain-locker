import { defineJobRoute } from '../lib/job-route';
import { runMonitor } from '../jobs/monitor';

export default defineJobRoute('domain-monitor', runMonitor);
