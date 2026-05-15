import { describe, expect, it } from 'vitest';
import {
  getAllByClientServer,
  getAllBySeverity,
  getAllWithActions,
  getByEppCode,
  getEppCodesBySeverity,
  makeEppArrayFromLabels,
  securityCategories,
} from '~/app/constants/security-categories';

describe('security-categories', () => {
  it('has a non-empty catalog', () => {
    expect(securityCategories.length).toBeGreaterThan(0);
  });

  it('looks up a category by EPP code', () => {
    const ok = getByEppCode('ok');
    expect(ok?.label).toBe('OK');
    expect(ok?.severity).toBe('good');
  });

  it('returns undefined for unknown EPP codes', () => {
    expect(getByEppCode('not-a-real-code')).toBeUndefined();
  });

  it('filters by severity', () => {
    const bad = getAllBySeverity('bad');
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.every((c) => c.severity === 'bad')).toBe(true);
  });

  it('returns only EPP code strings when filtering by severity', () => {
    const codes = getEppCodesBySeverity('good');
    expect(codes).toContain('ok');
    expect(codes.every((c) => typeof c === 'string')).toBe(true);
  });

  it('filters by setBy', () => {
    const server = getAllByClientServer('server');
    const client = getAllByClientServer('client');
    expect(server.every((c) => c.setBy === 'server')).toBe(true);
    expect(client.every((c) => c.setBy === 'client')).toBe(true);
  });

  it('returns only entries that define an action', () => {
    const actions = getAllWithActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((c) => typeof c.actionToTake === 'string')).toBe(true);
  });

  describe('makeEppArrayFromLabels', () => {
    it('maps labels back to full category objects', () => {
      const result = makeEppArrayFromLabels(['ok', 'pendingDelete']);
      expect(result.map((c) => c.eppCode)).toEqual(['ok', 'pendingDelete']);
    });

    it('drops unknown labels silently', () => {
      const result = makeEppArrayFromLabels(['ok', 'not-real']);
      expect(result).toHaveLength(1);
      expect(result[0].eppCode).toBe('ok');
    });

    it('sorts by severity: good, info, bad', () => {
      const result = makeEppArrayFromLabels(['pendingDelete', 'ok', 'inactive']);
      expect(result.map((c) => c.severity)).toEqual(['good', 'info', 'bad']);
    });

    it('returns empty array for empty/null input', () => {
      expect(makeEppArrayFromLabels([])).toEqual([]);
      expect(makeEppArrayFromLabels(null as unknown as string[])).toEqual([]);
    });
  });
});
