import { runQuery } from '../../../db/raw';
import { recordDomainUpdate } from '../lib/recordUpdate';
import { normalizeRegistrarName, normalizeStr, removeUrlChars } from '../lib/utils';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

async function upsertRegistrar(
  name: string,
  url: string | null,
  userId: string,
): Promise<string> {
  const sanitizedName = removeUrlChars(name);
  const registrars = await runQuery<{ id: string; name: string }>(
    `SELECT id, name FROM registrars WHERE user_id = $1`,
    [userId],
  );
  const targetName = normalizeRegistrarName(sanitizedName);
  const existing = registrars.find(
    (row) => normalizeRegistrarName(row.name) === targetName,
  );
  if (existing) return existing.id;

  const res = await runQuery<{ id: string }>(
    `
    INSERT INTO registrars (name, url, user_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, name) DO UPDATE SET url = EXCLUDED.url
    RETURNING id
  `,
    [sanitizedName, url, userId],
  );

  if (!res.length) throw new Error(`Failed to upsert registrar: ${name}`);
  return res[0].id;
}

export async function updateRegistrar(
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
): Promise<void> {
  const oldName = normalizeStr(removeUrlChars(domainRow.registrar?.name));
  const newName = normalizeStr(removeUrlChars(freshInfo?.registrar?.name));

  const userId = domainRow.user_id || 'a0000000-aaaa-42a0-a0a0-00a000000a69';

  if (!newName || normalizeRegistrarName(oldName) === normalizeRegistrarName(newName)) {
    return;
  }

  const registrarId = await upsertRegistrar(
    freshInfo.registrar.name,
    freshInfo.registrar.url ?? null,
    userId,
  );

  await recordDomainUpdate(
    domainRow.id,
    'Registrar changed',
    'registrar',
    oldName,
    newName,
  );

  await runQuery(`UPDATE domains SET registrar_id = $1 WHERE id = $2`, [
    registrarId,
    domainRow.id,
  ]);

  changes.push('Registrar');
}
