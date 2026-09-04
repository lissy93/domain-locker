import { describe, expect, it } from 'vitest';
import { toSavePayload } from './api-queries';
import type { SaveDomainData } from '~/app/../types/Database';

/** The edit form only ever collects these, which is what makes omission matter */
const notesOnlyEdit = {
  domain: {
    domain_name: 'archive.org',
    registrar: 'Namecheap',
    expiry_date: new Date('2027-06-01T00:00:00Z'),
    notes: 'Just the notes',
  },
  tags: ['archive'],
  notifications: [{ type: 'expiry_domain', isEnabled: true }],
  subdomains: [],
} as unknown as SaveDomainData;

describe('toSavePayload', () => {
  it('omits dates the caller never carried, so the server keeps them', () => {
    const payload = toSavePayload(notesOnlyEdit);

    expect('registration_date' in payload.domain!).toBe(false);
    expect('updated_date' in payload.domain!).toBe(false);
    expect(JSON.parse(JSON.stringify(payload)).domain).not.toHaveProperty(
      'registration_date',
    );
  });

  it('keeps a deliberate null, so a date can still be cleared', () => {
    const payload = toSavePayload({
      ...notesOnlyEdit,
      domain: { ...notesOnlyEdit.domain, registration_date: null },
    } as unknown as SaveDomainData);

    expect(payload.domain).toHaveProperty('registration_date', null);
  });

  it('sends dates as plain YYYY-MM-DD', () => {
    const payload = toSavePayload({
      ...notesOnlyEdit,
      domain: {
        ...notesOnlyEdit.domain,
        registration_date: new Date('1995-12-14T00:00:00Z'),
        updated_date: '2024-03-01',
      },
    } as unknown as SaveDomainData);

    expect(payload.domain).toMatchObject({
      expiry_date: '2027-06-01',
      registration_date: '1995-12-14',
      updated_date: '2024-03-01',
    });
  });

  it('omits relations the caller did not supply', () => {
    const payload = toSavePayload(notesOnlyEdit);

    for (const key of ['statuses', 'ipAddresses', 'ssl', 'whois', 'dns', 'host']) {
      expect(payload).not.toHaveProperty(key);
    }
    expect(payload.tags).toEqual(['archive']);
  });

  it('passes a full add through unchanged', () => {
    const payload = toSavePayload({
      domain: {
        domain_name: 'new.com',
        expiry_date: '2030-01-01',
        registration_date: '2020-01-01',
        updated_date: '2024-01-01',
        notes: '',
      },
      tags: [],
      notifications: [],
      statuses: ['clientTransferProhibited'],
      ipAddresses: [{ ipAddress: '1.2.3.4', isIpv6: false }],
      subdomains: [],
    } as unknown as SaveDomainData);

    expect(payload.domain).toEqual({
      domain_name: 'new.com',
      expiry_date: '2030-01-01',
      registration_date: '2020-01-01',
      updated_date: '2024-01-01',
      notes: '',
    });
    expect(payload.ipAddresses).toHaveLength(1);
  });
});
