import { defineJobRoute } from '../lib/job-route';
import { runReminders } from '../jobs/reminders';

export default defineJobRoute('expiration-reminders', runReminders);
