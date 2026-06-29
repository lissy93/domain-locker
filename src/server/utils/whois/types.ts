import type { Dates, Registrar, Contact, Abuse } from '../../../types/common';

export interface WhoisResult {
  domainName: string | null;
  status: string[];
  dnssec: string | null;
  dates: Partial<Dates>;
  registrar: Partial<Registrar>;
  whois: Partial<Contact>;
  abuse: Partial<Abuse>;
}
