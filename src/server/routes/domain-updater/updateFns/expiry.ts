import { runQuery } from '../../../db/raw';
import { recordDomainUpdate } from '../lib/recordUpdate';
import { toDateOnly, datesDifferBeyondThreshold } from '../lib/utils';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

export async function updateExpiryDate(
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
      domainRow.id,
      'Expiry date changed',
      'expiry_domain',
      oldDateStr,
      newDateStr,
    );

    await runQuery(`UPDATE domains SET expiry_date = $1::date WHERE id = $2`, [
      newDateStr,
      domainRow.id,
    ]);

    changes.push('Expiry Date');
  }
}
