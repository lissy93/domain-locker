import { callPgExecutor } from '../lib/pgExecutor';
import { recordDomainUpdate } from '../lib/recordUpdate';
import { toDateOnly, datesDifferBeyondThreshold } from '../lib/utils';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

export async function updateExpiryDate(
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
): Promise<void> {
  const oldRaw = domainRow.expiry_date;
  const newRaw = freshInfo?.dates?.expiry_date;

  if (!newRaw) return;

  const oldDateStr = toDateOnly(oldRaw);
  const newDateStr = toDateOnly(newRaw);

  if (!oldDateStr || datesDifferBeyondThreshold(oldDateStr, newDateStr, 7)) {
    await recordDomainUpdate(
      pgExec,
      domainRow.id,
      'Expiry date changed',
      'expiry_domain',
      oldDateStr,
      newDateStr,
    );

    await callPgExecutor(
      pgExec,
      `UPDATE domains SET expiry_date = $1::date WHERE id = $2::uuid`,
      [newDateStr, domainRow.id],
    );

    changes.push('Expiry Date');
  }
}
