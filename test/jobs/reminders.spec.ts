import { afterEach, describe, expect, it } from 'vitest';
import {
  crossedThreshold,
  daysUntil,
  matchedThreshold,
  reminderThresholds,
  thresholdCrossedAt,
} from '~/server/jobs/reminders';
import { notificationTypes } from '~/app/constants/notification-types';

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

  /** The reminder change type has to match a preference key, or nothing is sent */
  it('uses a change type the notification preferences actually enable', () => {
    const keys = notificationTypes.map((type) => type.key);
    expect(keys.some((key) => 'expiry_domain'.startsWith(key))).toBe(true);
  });

  it('reports which threshold was crossed, so a reminder sends once per threshold', () => {
    expect(matchedThreshold(7, [90, 30, 7, 2])).toBe(7);
    expect(matchedThreshold(6, [90, 30, 7, 2])).toBe(7);
    expect(matchedThreshold(20, [90, 30, 7, 2])).toBeNull();
  });

  it('still reminds on the day a domain expires', () => {
    expect(crossedThreshold(0, [90, 30, 7, 2, 0])).toBe(true);
  });

  /** The dedupe window has to include the reminder already sent today */
  it('dates the threshold crossing to the start of the day it happened', () => {
    const now = Date.parse('2026-06-01T13:45:00Z');
    expect(thresholdCrossedAt(7, 7, now)).toBe('2026-06-01T00:00:00.000Z');
    expect(thresholdCrossedAt(6, 7, now)).toBe('2026-05-31T00:00:00.000Z');
    expect(thresholdCrossedAt(0, 0, now)).toBe('2026-06-01T00:00:00.000Z');
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
    expect(reminderThresholds()).toEqual([90, 30, 7, 2, 0]);
  });
});
