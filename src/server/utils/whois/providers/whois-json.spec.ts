import { describe, expect, it } from 'vitest';
import { normalizeWhoisJson } from './whois-json';

// Field names below are what whois-json returns for each registry, captured live
describe('normalizeWhoisJson', () => {
  it('reads the .nc field names', () => {
    const result = normalizeWhoisJson({
      domain: 'whois.nc',
      createdOn: '2007-07-05T08:46:31.000Z',
      expiresOn: '2028-07-06',
      lastUpdatedOn: '2026-06-02T10:31:50.000Z',
      registrar: 'NONE',
    });

    expect(result.domainName).toBe('whois.nc');
    expect(result.dates.creation_date).toBe('2007-07-05');
    expect(result.dates.expiry_date).toBe('2028-07-06');
    expect(result.dates.updated_date).toBe('2026-06-02');
    expect(result.registrar.name).toBeUndefined();
  });

  it('reads registryExpiryDate, which .ovh and other gTLDs return', () => {
    const result = normalizeWhoisJson({
      domainName: 'nic.ovh',
      creationDate: '2014-02-06T16:38:02Z',
      registryExpiryDate: '2027-02-06T16:38:02Z',
      registrar: 'Registry Operations',
    });

    expect(result.dates.expiry_date).toBe('2027-02-06');
    expect(result.registrar.name).toBe('Registry Operations');
  });

  it('still reads the field names it already supported', () => {
    const result = normalizeWhoisJson({
      domainName: 'google.com',
      creationDate: '1997-09-15T07:00:00+0000',
      updatedDate: '2024-08-02T02:17:33+0000',
      registrarRegistrationExpirationDate: '2028-09-13T07:00:00+0000',
      registrar: 'MarkMonitor, Inc.',
    });

    expect(result.dates.creation_date).toBe('1997-09-15');
    expect(result.dates.updated_date).toBe('2024-08-02');
    expect(result.dates.expiry_date).toBe('2028-09-13');
    expect(result.registrar.name).toBe('MarkMonitor, Inc.');
  });
});
