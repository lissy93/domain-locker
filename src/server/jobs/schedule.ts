import { runJob, type JobName } from './runner';
import { runMonitor, runUptimeCleanup } from './monitor';
import { runUpdater } from './updater';
import { runReminders } from './reminders';
import Logger from '../utils/logger';

const log = new Logger('scheduler');

export interface Schedule {
  job: JobName;
  /** Minutes between runs */
  everyMinutes: number;
  run: () => Promise<unknown>;
}

const MINUTE = 60_000;

function minutesFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function schedules(): Schedule[] {
  return [
    {
      job: 'domain-monitor',
      everyMinutes: minutesFromEnv('DL_MONITOR_INTERVAL_MINUTES', 15),
      run: runMonitor,
    },
    {
      job: 'domain-updater',
      everyMinutes: minutesFromEnv('DL_UPDATER_INTERVAL_MINUTES', 24 * 60),
      run: runUpdater,
    },
    {
      job: 'expiration-reminders',
      everyMinutes: minutesFromEnv('DL_REMINDERS_INTERVAL_MINUTES', 24 * 60),
      run: runReminders,
    },
    {
      job: 'cleanup-monitor-data',
      everyMinutes: minutesFromEnv('DL_CLEANUP_INTERVAL_MINUTES', 7 * 24 * 60),
      run: runUptimeCleanup,
    },
  ];
}

let timers: NodeJS.Timeout[] = [];

/**
 * Runs the scheduled jobs from inside the app, so a self-hosted install needs
 * no companion cron container. Job locks mean an old updater container hitting
 * the legacy routes cannot double up.
 */
export function startScheduler(): void {
  if (timers.length) return;
  if (process.env['DL_DISABLE_SCHEDULER'] === 'true') {
    log.info('Internal scheduler disabled by DL_DISABLE_SCHEDULER');
    return;
  }

  for (const schedule of schedules()) {
    const interval = schedule.everyMinutes * MINUTE;
    const timer = setInterval(() => {
      void runJob(schedule.job, schedule.run);
    }, interval);
    timer.unref?.();
    timers.push(timer);
    log.info(`Scheduled ${schedule.job} every ${schedule.everyMinutes} minutes`);
  }
}

export function stopScheduler(): void {
  timers.forEach((timer) => clearInterval(timer));
  timers = [];
}
