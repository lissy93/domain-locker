import { callPgExecutor } from '../lib/pgExecutor';
import { toDateOnly } from '../lib/utils';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

/* Silently keep the registry creation/updated dates current (no notifications) */
export async function updateDomainDates(
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
): Promise<void> {
  const pending: { column: string; label: string; value: string }[] = [];

  // updated_date moves whenever the registry record changes, track it quietly
  const freshUpdated = toDateOnly(freshInfo?.dates?.updated_date);
  if (freshUpdated && freshUpdated !== toDateOnly(domainRow.updated_date)) {
    pending.push({ column: 'updated_date', label: 'Updated Date', value: freshUpdated });
  }

  // registration_date is immutable, only backfill it when we have no value yet
  const freshCreated = toDateOnly(freshInfo?.dates?.creation_date);
  if (freshCreated && !toDateOnly(domainRow.registration_date)) {
    pending.push({
      column: 'registration_date',
      label: 'Registration Date',
      value: freshCreated,
    });
  }

  for (const { column, label, value } of pending) {
    await callPgExecutor(
      pgExec,
      `UPDATE domains SET ${column} = $1::timestamptz WHERE id = $2::uuid`,
      [`${value}T00:00:00Z`, domainRow.id],
    );
    changes.push(label);
  }
}
