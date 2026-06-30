import { updateExpiryDate } from './../updateFns/expiry';
import { updateDomainDates } from './../updateFns/dates';
import { updateRegistrar } from './../updateFns/registrar';
import { updateDomainStatuses } from './../updateFns/statuses';
import { updateSSL } from './../updateFns/ssl';
import { updateWhois } from './../updateFns/whois';
import { updateDNS } from './../updateFns/dns';
import { updateHost } from './../updateFns/hosts';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from './fetchInfo';

type UpdateFn = (
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
) => Promise<void>;

export async function compareAndUpdateDomain(
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
) {
  const changes: string[] = [];

  const fns: UpdateFn[] = [
    updateExpiryDate,
    updateDomainDates,
    updateRegistrar,
    updateDomainStatuses,
    updateSSL,
    updateWhois,
    updateDNS,
    updateHost,
  ];

  for (const fn of fns) {
    try {
      await fn(pgExec, domainRow, freshInfo, changes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      changes.push(`(⚠️ Error in ${fn.name}: ${msg})`);
    }
  }

  return { domain: domainRow.domain_name, changes };
}
