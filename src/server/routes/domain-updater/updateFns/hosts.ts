import { callPgExecutor } from '../lib/pgExecutor';
import { normalizeStr } from '../lib/utils';
import { recordDomainUpdate } from '../lib/recordUpdate';
import type { DomainRow } from '../index';
import type { FreshDomainInfo } from '../lib/fetchInfo';

type HostRecord = Record<string, unknown>;

export async function updateHost(
  pgExec: string,
  domainRow: DomainRow,
  freshInfo: FreshDomainInfo,
  changes: string[],
): Promise<void> {
  const domainId = domainRow.id;
  const userId = domainRow.user_id;
  const fresh = freshInfo?.host as HostRecord | undefined;
  if (!fresh || !fresh['query'] || !userId) return;

  const existing: HostRecord = (domainRow.host as HostRecord) || {};

  const fields = [
    'ip',
    'lat',
    'lon',
    'isp',
    'org',
    'as_number',
    'city',
    'region',
    'country',
  ] as const;

  const getNum = (obj: HostRecord, field: string) =>
    obj?.[field] !== undefined ? Number(obj[field]) : null;

  const mappedFresh: Record<(typeof fields)[number], unknown> = {
    ip: fresh['query'],
    lat: getNum(fresh, 'lat'),
    lon: getNum(fresh, 'lon'),
    isp: fresh['isp'],
    org: fresh['org'],
    as_number: fresh['as'],
    city: fresh['city'],
    region: fresh['region'] || fresh['regionName'],
    country: fresh['country'],
  };

  const hasChanged = fields.some((f) => {
    const oldVal =
      typeof mappedFresh[f] === 'number'
        ? Number(existing?.[f] ?? -1)
        : normalizeStr(existing?.[f] as string | null | undefined);

    const newVal =
      typeof mappedFresh[f] === 'number'
        ? Number(mappedFresh[f] ?? -1)
        : normalizeStr(mappedFresh[f] as string | null | undefined);

    return oldVal !== newVal;
  });

  if (!hasChanged) return;

  // Find the host for this IP and refresh its details, else insert a new one
  const existingHost = await callPgExecutor<{ id: string }>(
    pgExec,
    `SELECT id FROM hosts WHERE user_id = $1 AND ip = $2 LIMIT 1`,
    [userId, mappedFresh.ip],
  );

  let hostId: string;

  if (existingHost.length > 0) {
    hostId = existingHost[0].id;
    await callPgExecutor(
      pgExec,
      `UPDATE hosts SET lat = $1, lon = $2, isp = $3, org = $4,
         as_number = $5, city = $6, region = $7, country = $8 WHERE id = $9`,
      [
        mappedFresh.lat,
        mappedFresh.lon,
        mappedFresh.isp,
        mappedFresh.org,
        mappedFresh.as_number,
        mappedFresh.city,
        mappedFresh.region,
        mappedFresh.country,
        hostId,
      ],
    );
  } else {
    const inserted = await callPgExecutor<{ id: string }>(
      pgExec,
      `
      INSERT INTO hosts (ip, lat, lon, isp, org, as_number, city, region, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
      `,
      fields.map((f) => mappedFresh[f] ?? null),
    );
    hostId = inserted[0].id;
  }

  // Link the host to the domain, replacing any previous host
  await callPgExecutor(
    pgExec,
    `DELETE FROM domain_hosts WHERE domain_id = $1 AND host_id <> $2`,
    [domainId, hostId],
  );
  await callPgExecutor(
    pgExec,
    `INSERT INTO domain_hosts (domain_id, host_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [domainId, hostId],
  );

  await recordDomainUpdate(
    pgExec,
    domainId,
    'Host changed',
    'host_changed',
    String(existing['ip'] ?? ''),
    String(mappedFresh.ip ?? ''),
  );

  changes.push('Host');
}
