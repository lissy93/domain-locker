import { callPgExecutor } from '../lib/pgExecutor';
import { normalizeStr } from '../lib/utils';
import { recordDomainUpdate } from '../lib/recordUpdate';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

export async function updateDNS(
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
): Promise<void> {
  const dns = freshInfo?.dns;
  if (!dns) return;

  const domainId = domainRow.id;
  const types = ['TXT', 'NS', 'MX'] as const;

  for (const type of types) {
    const key = type.toLowerCase() as 'txt' | 'ns' | 'mx';
    const freshRecords = Array.isArray(dns[key]) ? (dns[key] as string[]) : [];

    // Skip if no fresh data for this type - don't assume records were deleted
    if (freshRecords.length === 0) continue;

    const freshSet = new Set(
      freshRecords.map((r: string) => normalizeStr(r)).filter(Boolean),
    );

    const existing = await callPgExecutor<{ id: string; record_value: string }>(
      pgExec,
      `SELECT id, record_value FROM dns_records WHERE domain_id = $1 AND record_type = $2`,
      [domainId, type],
    );

    const existingSet = new Set(
      existing.map((row) => normalizeStr(row.record_value)).filter(Boolean),
    );

    // Add new records
    for (const record of freshSet) {
      if (!existingSet.has(record)) {
        await callPgExecutor(
          pgExec,
          `INSERT INTO dns_records (domain_id, record_type, record_value) VALUES ($1, $2, $3)`,
          [domainId, type, record],
        );
        await recordDomainUpdate(
          pgExec,
          domainId,
          `DNS ${type} record added`,
          `dns_${type.toLowerCase()}_added`,
          '',
          record,
        );
        changes.push(`DNS ${type}+`);
      }
    }

    // Remove stale records only if we received fresh data
    for (const row of existing) {
      const normalized = normalizeStr(row.record_value);
      if (!freshSet.has(normalized)) {
        await callPgExecutor(pgExec, `DELETE FROM dns_records WHERE id = $1`, [row.id]);
        await recordDomainUpdate(
          pgExec,
          domainId,
          `DNS ${type} record removed`,
          `dns_${type.toLowerCase()}_removed`,
          row.record_value,
          '',
        );
        changes.push(`DNS ${type}-`);
      }
    }
  }
}
