import { callPgExecutor } from '../lib/pgExecutor';
import { normalizeStr } from '../lib/utils';
import { recordDomainUpdate } from '../lib/recordUpdate';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

interface WhoisField {
  label: string;
  column: string;
  changeType: string;
  dbValue: string;
  freshValue: string;
}

interface WhoisRow {
  domain_id: string;
  name?: string;
  organization?: string;
  country?: string;
  state?: string;
  city?: string;
  street?: string;
  postal_code?: string;
}

export async function updateWhois(
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
): Promise<void> {
  const domainId = domainRow.id;
  const fresh = freshInfo?.whois;
  if (!fresh) return;

  // Fetch existing row
  const [existing] = await callPgExecutor<WhoisRow>(
    pgExec,
    `SELECT * FROM whois_info WHERE domain_id = $1`,
    [domainId],
  );

  const fields: WhoisField[] = [
    {
      label: 'Name',
      column: 'name',
      changeType: 'whois_name',
      dbValue: existing?.name ?? '',
      freshValue: fresh.name ?? '',
    },
    {
      label: 'Organization',
      column: 'organization',
      changeType: 'whois_organization',
      dbValue: existing?.organization ?? '',
      freshValue: fresh.organization ?? '',
    },
    {
      label: 'Country',
      column: 'country',
      changeType: 'whois_country',
      dbValue: existing?.country ?? '',
      freshValue: fresh.country ?? '',
    },
    {
      label: 'State',
      column: 'state',
      changeType: 'whois_state',
      dbValue: existing?.state ?? '',
      freshValue: fresh.state ?? '',
    },
    {
      label: 'City',
      column: 'city',
      changeType: 'whois_city',
      dbValue: existing?.city ?? '',
      freshValue: fresh.city ?? '',
    },
    {
      label: 'Street',
      column: 'street',
      changeType: 'whois_street',
      dbValue: existing?.street ?? '',
      freshValue: fresh.street ?? '',
    },
    {
      label: 'Postal Code',
      column: 'postal_code',
      changeType: 'whois_postal_code',
      dbValue: existing?.postal_code ?? '',
      freshValue: fresh.postal_code ?? '',
    },
  ];

  // If no existing WHOIS row, insert one
  if (!existing) {
    await callPgExecutor(
      pgExec,
      `INSERT INTO whois_info (domain_id, ${fields.map((f) => f.column).join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})`,
      [domainId, ...fields.map((f) => f.freshValue || null)],
    );

    await recordDomainUpdate(
      pgExec,
      domainId,
      'WHOIS record created',
      'whois_',
      '',
      JSON.stringify(fresh),
    );
    changes.push('WHOIS created');
    return;
  }

  // Otherwise, compare and update fields
  const setFragments: string[] = [];
  const updateParams: unknown[] = [];

  for (const field of fields) {
    const oldVal = normalizeStr(field.dbValue);
    const newVal = normalizeStr(field.freshValue);
    if (oldVal !== newVal) {
      setFragments.push(`${field.column} = $${setFragments.length + 2}`);
      updateParams.push(field.freshValue || null);
      await recordDomainUpdate(
        pgExec,
        domainId,
        `WHOIS ${field.label} changed`,
        field.changeType,
        field.dbValue,
        field.freshValue,
      );
      changes.push(`WHOIS ${field.label}`);
    }
  }

  if (setFragments.length > 0) {
    await callPgExecutor(
      pgExec,
      `UPDATE whois_info SET ${setFragments.join(', ')} WHERE domain_id = $1`,
      [domainId, ...updateParams],
    );
  }
}
