import { callPgExecutor } from '../lib/pgExecutor';
import { normalizeStr } from '../lib/utils';
import { recordDomainUpdate } from '../lib/recordUpdate';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

export async function updateDomainStatuses(
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
): Promise<void> {
  const domainId = domainRow.id;
  const freshStatuses = Array.isArray(freshInfo?.status) ? freshInfo.status : [];

  const freshSet = new Set<string>(
    freshStatuses.map((s: string) => normalizeStr(s)).filter(Boolean) as string[],
  );

  const existing = await callPgExecutor<{ id: string; status_code: string }>(
    pgExec,
    `SELECT id, status_code FROM domain_statuses WHERE domain_id = $1`,
    [domainId],
  );

  const existingSet = new Set(
    existing.map((row) => normalizeStr(row.status_code)).filter(Boolean),
  );

  // Add new statuses
  for (const status of freshSet) {
    if (!existingSet.has(status)) {
      await callPgExecutor(
        pgExec,
        `INSERT INTO domain_statuses (domain_id, status_code) VALUES ($1, $2)`,
        [domainId, status],
      );
      await recordDomainUpdate(
        pgExec,
        domainId,
        `Status added: ${status}`,
        'status',
        '',
        status,
      );
      changes.push(`Status+: ${status}`);
    }
  }

  // Remove old statuses
  for (const row of existing) {
    const normalized = normalizeStr(row.status_code);
    if (!freshSet.has(normalized)) {
      await callPgExecutor(pgExec, `DELETE FROM domain_statuses WHERE id = $1`, [row.id]);
      await recordDomainUpdate(
        pgExec,
        domainId,
        `Status removed: ${row.status_code}`,
        'status',
        row.status_code,
        '',
      );
      changes.push(`Status-: ${row.status_code}`);
    }
  }
}
