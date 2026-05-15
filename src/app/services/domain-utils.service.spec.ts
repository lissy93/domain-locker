import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainUtils } from '~/app/services/domain-utils.service';

const daysFromNow = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

describe('DomainUtils', () => {
  let utils: DomainUtils;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    utils = TestBed.inject(DomainUtils);
  });

  describe('splitDomain', () => {
    it('splits a simple domain into name and tld', () => {
      expect(utils.splitDomain('example.com')).toEqual({
        domain: 'example',
        tld: 'com',
      });
    });

    it('joins multi-level tlds back together', () => {
      expect(utils.splitDomain('example.co.uk')).toEqual({
        domain: 'example',
        tld: 'co.uk',
      });
    });

    it('returns empty pair for null-ish input', () => {
      expect(utils.splitDomain('')).toEqual({ domain: '', tld: '' });
    });

    it('returns the name only when no tld is present', () => {
      expect(utils.splitDomain('localhost')).toEqual({
        domain: 'localhost',
        tld: '',
      });
    });
  });

  describe('truncateNotes', () => {
    it('returns short strings untouched', () => {
      expect(utils.truncateNotes('hello world')).toBe('hello world');
    });

    it('truncates strings longer than 64 chars with ellipsis', () => {
      const long = 'x'.repeat(80);
      const result = utils.truncateNotes(long);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBe(67);
    });

    it('treats empty input as empty string', () => {
      expect(utils.truncateNotes('')).toBe('');
    });
  });

  describe('expiry helpers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns days remaining as positive when in future', () => {
      expect(utils.getDaysRemaining(daysFromNow(30))).toBe(30);
    });

    it('returns negative days when expired', () => {
      expect(utils.getDaysRemaining(daysFromNow(-5))).toBe(-5);
    });

    it('classifies severity by remaining days', () => {
      expect(utils.getExpirySeverity(daysFromNow(120))).toBe('success');
      expect(utils.getExpirySeverity(daysFromNow(45))).toBe('warning');
      expect(utils.getExpirySeverity(daysFromNow(5))).toBe('danger');
    });

    it('formats remaining text by bucket', () => {
      expect(utils.getRemainingDaysText(daysFromNow(-1))).toBe('Expired');
      expect(utils.getRemainingDaysText(daysFromNow(45))).toBe('45 days');
      expect(utils.getRemainingDaysText(daysFromNow(500))).toMatch(/months$/);
      expect(utils.getRemainingDaysText(daysFromNow(2000))).toMatch(/years$/);
    });
  });

  describe('extractTags', () => {
    it('reads nested tags from /domains shape', () => {
      const data = {
        domain_tags: [
          { tags: { name: 'work' } },
          { tags: { name: 'personal' } },
          { tags: null },
        ],
      };
      expect(utils.extractTags(data)).toEqual(['work', 'personal']);
    });

    it('reads a single tag from /assets/tags shape', () => {
      expect(utils.extractTags({ tags: 'cool-tag' })).toEqual(['cool-tag']);
    });

    it('returns empty array when no tags present', () => {
      expect(utils.extractTags({})).toEqual([]);
    });
  });

  describe('formatDomainData', () => {
    it('maps raw db records into the DbDomain shape', () => {
      const raw = {
        domain_name: 'example.com',
        domain_tags: [{ tags: { name: 'work' } }],
        ssl_certificates: [{ issuer: 'Lets Encrypt' }],
        whois_info: { registrant: 'Alice' },
        registrars: { name: 'Namecheap' },
        domain_hosts: [{ hosts: { name: 'CloudFlare' } }],
        dns_records: [
          { record_type: 'MX', record_value: 'mail.example.com' },
          { record_type: 'TXT', record_value: 'v=spf1' },
          { record_type: 'NS', record_value: 'ns1.example.com' },
          { record_type: 'A', record_value: '1.2.3.4' },
        ],
        domain_statuses: [{ status_code: 'ok' }],
      };
      const result = utils.formatDomainData(raw) as unknown as Record<string, unknown>;

      expect(result['tags']).toEqual(['work']);
      expect(result['ssl']).toEqual({ issuer: 'Lets Encrypt' });
      expect(result['whois']).toEqual({ registrant: 'Alice' });
      expect(result['registrar']).toEqual({ name: 'Namecheap' });
      expect(result['host']).toEqual({ name: 'CloudFlare' });
      expect((result['dns'] as { mxRecords: string[] }).mxRecords).toEqual([
        'mail.example.com',
      ]);
      expect((result['dns'] as { txtRecords: string[] }).txtRecords).toEqual(['v=spf1']);
      expect((result['dns'] as { nameServers: string[] }).nameServers).toEqual([
        'ns1.example.com',
      ]);
      expect(Array.isArray(result['statuses'])).toBe(true);
      expect((result['statuses'] as { eppCode: string }[])[0].eppCode).toBe('ok');
    });

    it('handles missing optional collections without throwing', () => {
      const result = utils.formatDomainData({
        domain_name: 'minimal.com',
      }) as unknown as Record<string, unknown>;
      expect(result['ssl']).toBeNull();
      expect(result['host']).toBeNull();
      expect((result['dns'] as { mxRecords: string[] }).mxRecords).toEqual([]);
      expect(result['statuses']).toEqual([]);
    });
  });
});
