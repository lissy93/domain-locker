import { describe, expect, it } from 'vitest';
import { parseTrabis } from './whois';

/**
 * Real captured responses from `nc whois.trabis.gov.tr 43` against four .tr
 * domains. Trabis's format is line-based and stable; these strings let us
 * lock the parser in without hitting the network from tests.
 */

const FIXTURE_CANATA = `** Domain Name: canata.com.tr
Domain Status: Active
Frozen Status: -
Transfer Status: The domain is LOCKED to transfer.

** Registrant:

Hidden upon user request
Hidden upon user request
Hidden upon user request
Hidden upon user request


** Registrar:
NIC Handle\t\t: ogv40
Organization Name\t: ODTÜ GELİŞTİRME VAKFI BİLGİ TEKNOLOJİLERİ SAN. VE TİC. A.Ş.
Address\t\t\t: Mustafa Kemal Mahallesi Dumlupınar Bulvarı
\t\t\t  No:280G/1104 Çankaya
\t\t\t  06800 Ankara Türkiye
Phone\t\t\t: 90-312-9881106-
Fax\t\t\t: -


** Domain Servers:
kim.ns.cloudflare.com
jeff.ns.cloudflare.com


** Additional Info:
Created on..............: 2022-Sep-14.
Expires on..............: 2026-Sep-13.


** Whois Server:
Last Update Time: 2026-05-28T16:16:33+03:00

`;

const FIXTURE_8092_APEX = `** Domain Name: 8092.tr
Domain Status: Active
Frozen Status: -
Transfer Status: The domain is LOCKED to transfer.

** Registrant:

Hidden upon user request
Hidden upon user request
Hidden upon user request
Hidden upon user request


** Registrar:
NIC Handle\t\t: ogv40
Organization Name\t: ODTÜ GELİŞTİRME VAKFI BİLGİ TEKNOLOJİLERİ SAN. VE TİC. A.Ş.
Address\t\t\t: Mustafa Kemal Mahallesi Dumlupınar Bulvarı

** Additional Info:
Created on..............: 2025-Sep-17.
Expires on..............: 2026-Sep-16.

Last Update Time: 2026-05-28T16:16:33+03:00
`;

const FIXTURE_NOT_FOUND = `** No match for "this-domain-does-not-exist.tr".`;

describe('parseTrabis', () => {
  it('parses a .com.tr response', () => {
    const out = parseTrabis('canata.com.tr', FIXTURE_CANATA);
    expect(out).not.toBeNull();
    expect(out!.domainName).toBe('canata.com.tr');
    expect(out!.registrar.name).toContain('ODTÜ GELİŞTİRME VAKFI');
    expect(out!.registrar.id).toBe('ogv40');
    expect(out!.dates.creation_date).toBe('2022-09-14');
    expect(out!.dates.expiry_date).toBe('2026-09-13');
    expect(out!.dates.updated_date).toBe('2026-05-28');
    expect(out!.status).toContain('ok');
    expect(out!.status).toContain('clientTransferProhibited');
    expect(out!.whois.country).toBe('TR');
    expect(out!.abuse.phone).toBe('90-312-9881106-');
    expect(out!.dnssec).toBeNull();
  });

  it('parses a .tr apex response', () => {
    const out = parseTrabis('8092.tr', FIXTURE_8092_APEX);
    expect(out).not.toBeNull();
    expect(out!.domainName).toBe('8092.tr');
    expect(out!.dates.creation_date).toBe('2025-09-17');
    expect(out!.dates.expiry_date).toBe('2026-09-16');
  });

  it('returns null on "no match" responses', () => {
    expect(parseTrabis('foo.tr', FIXTURE_NOT_FOUND)).toBeNull();
  });

  it('returns null on empty / suspiciously short responses', () => {
    expect(parseTrabis('foo.tr', '')).toBeNull();
    expect(parseTrabis('foo.tr', 'too short')).toBeNull();
  });
});
