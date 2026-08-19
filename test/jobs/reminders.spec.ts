import { afterEach, describe, expect, it } from 'vitest';
import { crossedThreshold, daysUntil, reminderThresholds } from '~/server/jobs/reminders';

describe('expiry reminder windows', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('counts whole days to expiry', () => {
    const today = new Date('2026-06-01T13:45:00Z');
    expect(daysUntil('2026-06-08', today)).toBe(7);
    expect(daysUntil('2026-06-01', today)).toBe(0);
    expect(daysUntil('2026-05-30', today)).toBe(-2);
  });

  it('fires on the threshold day', () => {
    expect(crossedThreshold(7, [90, 30, 7, 2])).toBe(true);
    expect(crossedThreshold(30, [90, 30, 7, 2])).toBe(true);
  });

  /** The old code compared exact days, so a missed run lost the reminder */
  it('still fires the day after a missed run', () => {
    expect(crossedThreshold(6, [90, 30, 7, 2])).toBe(true);
    expect(crossedThreshold(29, [90, 30, 7, 2])).toBe(true);
  });

  it('stays quiet well between thresholds', () => {
    expect(crossedThreshold(45, [90, 30, 7, 2])).toBe(false);
    expect(crossedThreshold(20, [90, 30, 7, 2])).toBe(false);
  });

  it('ignores domains that already expired', () => {
    expect(crossedThreshold(-1, [90, 30, 7, 2])).toBe(false);
  });

  it('reads thresholds from the environment, largest first', () => {
    process.env['DL_EXPIRATION_REMINDER_DAYS'] = '3, 14 ,60';
    expect(reminderThresholds()).toEqual([60, 14, 3]);
  });

  it('falls back to the defaults when the setting is unusable', () => {
    process.env['DL_EXPIRATION_REMINDER_DAYS'] = 'soon, -4';
    expect(reminderThresholds()).toEqual([90, 30, 7, 2]);
  });
});
