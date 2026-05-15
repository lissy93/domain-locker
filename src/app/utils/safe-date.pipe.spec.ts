import { describe, expect, it } from 'vitest';
import { SafeDatePipe } from '~/app/utils/safe-date.pipe';

describe('SafeDatePipe', () => {
  const pipe = new SafeDatePipe();

  it('returns fallback when value is null/undefined', () => {
    expect(pipe.transform(null)).toBe('Unknown');
    expect(pipe.transform(undefined)).toBe('Unknown');
  });

  it('returns fallback when value is not parseable', () => {
    expect(pipe.transform('not-a-date')).toBe('Unknown');
  });

  it('accepts a custom fallback', () => {
    expect(pipe.transform(null, 'medium', '-')).toBe('-');
  });

  it('formats a valid ISO date string', () => {
    const result = pipe.transform('2026-01-15T00:00:00Z');
    expect(result).toMatch(/2026/);
    expect(result).not.toBe('Unknown');
  });

  it('formats a Date instance', () => {
    const result = pipe.transform(new Date('2026-06-01'));
    expect(result).toMatch(/2026/);
  });
});
