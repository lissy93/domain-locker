import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../schema';
import { normalizeRegistrarName, removeUrlChars } from '../../jobs/updater/utils';
import { currentUserId, toJsonString } from './helpers';

type Db = Kysely<Database> | Transaction<Database>;

export interface SaveDomainInput {
  domain: {
    domain_name: string;
    expiry_date?: string | null;
    registration_date?: string | null;
    updated_date?: string | null;
    notes?: string | null;
    registrar?: string | { name?: string; url?: string | null } | null;
  };
  tags?: string[];
  notifications?: { type: string; isEnabled: boolean }[];
  statuses?: string[];
  ipAddresses?: { ipAddress: string; isIpv6: boolean }[];
  ssl?: Record<string, unknown> | null;
  whois?: Record<string, unknown> | null;
  dns?: { mxRecords?: string[]; txtRecords?: string[]; nameServers?: string[] } | null;
  host?: Record<string, unknown> | null;
  subdomains?: { name: string; sd_info?: unknown }[];
  links?: { link_name: string; link_url: string; link_description?: string | null }[];
}

const DNS_TYPES = {
  mxRecords: 'MX',
  txtRecords: 'TXT',
  nameServers: 'NS',
} as const;

/** Creates a domain and every relation it arrived with, in one transaction */
export async function insertDomain(
  db: Kysely<Database>,
  input: SaveDomainInput,
  userId = currentUserId(),
): Promise<string> {
  return db.transaction().execute(async (trx) => {
    const registrarId = await upsertRegistrar(trx, input.domain.registrar, userId);

    const domain = await trx
      .insertInto('domains')
      .values({
        user_id: userId,
        domain_name: input.domain.domain_name,
        expiry_date: input.domain.expiry_date ?? null,
        registration_date: input.domain.registration_date ?? null,
        updated_date: input.domain.updated_date ?? null,
        notes: input.domain.notes ?? null,
        registrar_id: registrarId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await writeRelations(trx, domain.id, input, userId);
    return domain.id;
  });
}

/** Replaces the domain's editable fields and the relations present in the input */
export async function updateDomain(
  db: Kysely<Database>,
  domainId: string,
  input: SaveDomainInput,
  userId = currentUserId(),
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    const owned = await trx
      .selectFrom('domains')
      .where('id', '=', domainId)
      .where('user_id', '=', userId)
      .select('id')
      .executeTakeFirst();
    if (!owned) return false;

    const registrarId = await upsertRegistrar(trx, input.domain.registrar, userId);
    const changes = editableChanges(input.domain, registrarId);
    if (Object.keys(changes).length) {
      await trx.updateTable('domains').set(changes).where('id', '=', domainId).execute();
    }

    await clearReplacedRelations(trx, domainId, input);
    await writeRelations(trx, domainId, input, userId);
    return true;
  });
}

const EDITABLE_COLUMNS = [
  'expiry_date',
  'registration_date',
  'updated_date',
  'notes',
] as const;

/** Omitted columns keep their value, so an edit cannot wipe a date it never carried */
function editableChanges(domain: SaveDomainInput['domain'], registrarId: string | null) {
  const changes: Record<string, string | null> = {};
  for (const column of EDITABLE_COLUMNS) {
    if (domain[column] !== undefined) changes[column] = domain[column] ?? null;
  }
  // An empty registrar clears it
  if (domain.registrar !== undefined) changes['registrar_id'] = registrarId;
  return changes;
}

/** Which table each replaceable relation lives in */
const RELATION_TABLES = {
  tags: 'domain_tags',
  notifications: 'notification_preferences',
  links: 'domain_links',
  statuses: 'domain_statuses',
  ipAddresses: 'ip_addresses',
  dns: 'dns_records',
  ssl: 'ssl_certificates',
  whois: 'whois_info',
} as const;

/** Clears only the relations the caller sent. null counts as not sent */
async function clearReplacedRelations(
  trx: Transaction<Database>,
  domainId: string,
  input: SaveDomainInput,
) {
  const supplied = Object.entries(RELATION_TABLES).filter(
    ([field]) => input[field as keyof typeof RELATION_TABLES] != null,
  );
  await Promise.all(
    supplied.map(([, table]) =>
      trx.deleteFrom(table).where('domain_id', '=', domainId).execute(),
    ),
  );
}

async function writeRelations(
  trx: Transaction<Database>,
  domainId: string,
  input: SaveDomainInput,
  userId: string,
) {
  if (input.ipAddresses?.length) {
    await trx
      .insertInto('ip_addresses')
      .values(
        input.ipAddresses.map((ip) => ({
          domain_id: domainId,
          ip_address: ip.ipAddress,
          is_ipv6: ip.isIpv6,
        })),
      )
      .execute();
  }

  if (input.tags?.length) {
    await linkTags(trx, domainId, input.tags, userId);
  }

  if (input.notifications?.length) {
    await trx
      .insertInto('notification_preferences')
      .values(
        input.notifications.map((notification) => ({
          domain_id: domainId,
          notification_type: notification.type,
          is_enabled: notification.isEnabled,
        })),
      )
      .onConflict((conflict) =>
        conflict
          .columns(['domain_id', 'notification_type'])
          .doUpdateSet((eb) => ({ is_enabled: eb.ref('excluded.is_enabled') })),
      )
      .execute();
  }

  const dnsRows = Object.entries(DNS_TYPES).flatMap(([key, recordType]) =>
    (input.dns?.[key as keyof typeof DNS_TYPES] ?? []).map((value) => ({
      domain_id: domainId,
      record_type: recordType,
      record_value: value,
    })),
  );
  if (dnsRows.length) {
    await trx
      .insertInto('dns_records')
      .values(dnsRows)
      .onConflict((conflict) =>
        conflict.columns(['domain_id', 'record_type', 'record_value']).doNothing(),
      )
      .execute();
  }

  if (input.ssl && Object.keys(input.ssl).length) {
    await trx
      .insertInto('ssl_certificates')
      .values({ domain_id: domainId, ...pickSslFields(input.ssl) })
      .execute();
  }

  if (input.whois && Object.keys(input.whois).length) {
    await trx
      .insertInto('whois_info')
      .values({ domain_id: domainId, ...pickWhoisFields(input.whois) })
      .execute();
  }

  if (input.host && hostColumns(input.host).ip) {
    await linkHost(trx, domainId, input.host, userId);
  }

  if (input.statuses?.length) {
    await trx
      .insertInto('domain_statuses')
      .values(
        input.statuses.map((statusCode) => ({
          domain_id: domainId,
          status_code: statusCode,
        })),
      )
      .execute();
  }

  if (input.subdomains) {
    await mergeSubdomains(trx, domainId, input.subdomains);
  }

  if (input.links?.length) {
    await trx
      .insertInto('domain_links')
      .values(
        input.links.map((link) => ({
          domain_id: domainId,
          link_name: link.link_name,
          link_url: link.link_url,
          link_description: link.link_description ?? null,
        })),
      )
      .execute();
  }
}

/** Replaces subdomains by name, keeping the sd_info of any that stay */
async function mergeSubdomains(
  trx: Transaction<Database>,
  domainId: string,
  subdomains: NonNullable<SaveDomainInput['subdomains']>,
) {
  const existing = new Map(
    (
      await trx
        .selectFrom('sub_domains')
        .where('domain_id', '=', domainId)
        .select(['name', 'sd_info'])
        .execute()
    ).map((row) => [row.name, row.sd_info]),
  );

  await trx.deleteFrom('sub_domains').where('domain_id', '=', domainId).execute();
  if (!subdomains.length) return;

  await trx
    .insertInto('sub_domains')
    .values(
      subdomains.map((subdomain) => ({
        domain_id: domainId,
        name: subdomain.name,
        sd_info:
          subdomain.sd_info == null
            ? toJsonString(existing.get(subdomain.name))
            : JSON.stringify(subdomain.sd_info),
      })),
    )
    .execute();
}

/** Finds or creates the user's registrar, returning null when none was given */
export async function upsertRegistrar(
  db: Db,
  registrar: SaveDomainInput['domain']['registrar'],
  userId: string,
): Promise<string | null> {
  const name = removeUrlChars(
    typeof registrar === 'string' ? registrar : registrar?.name,
  );
  if (!name) return null;
  const url = typeof registrar === 'string' ? null : (registrar?.url ?? null);

  // Loose match, so NameCheap and Namecheap don't become two registrars
  const target = normalizeRegistrarName(name);
  const rows = await db
    .selectFrom('registrars')
    .where('user_id', '=', userId)
    .select(['id', 'name'])
    .execute();
  const existing = rows.find((row) => normalizeRegistrarName(row.name) === target);
  if (existing) return existing.id;

  const inserted = await db
    .insertInto('registrars')
    .values({ name, url, user_id: userId })
    .returning('id')
    .executeTakeFirstOrThrow();
  return inserted.id;
}

/** Creates any missing tags, then links all of them to the domain */
export async function linkTags(
  db: Db,
  domainId: string,
  tagNames: string[],
  userId: string,
): Promise<void> {
  const names = [...new Set(tagNames.filter(Boolean))];
  if (!names.length) return;

  await db
    .insertInto('tags')
    .values(names.map((name) => ({ name, user_id: userId })))
    .onConflict((conflict) => conflict.columns(['user_id', 'name']).doNothing())
    .execute();

  const tags = await db
    .selectFrom('tags')
    .where('user_id', '=', userId)
    .where('name', 'in', names)
    .select('id')
    .execute();

  if (!tags.length) return;
  await db
    .insertInto('domain_tags')
    .values(tags.map((tag) => ({ domain_id: domainId, tag_id: tag.id })))
    .onConflict((conflict) => conflict.columns(['domain_id', 'tag_id']).doNothing())
    .execute();
}

/**
 * The lookup API names these differently from the columns, and callers may
 * already have mapped them, so accept either spelling
 */
function hostColumns(host: Record<string, unknown>) {
  return {
    ip: stringOrNull(host['ip'] ?? host['query']),
    lat: numberOrNull(host['lat']),
    lon: numberOrNull(host['lon']),
    isp: stringOrNull(host['isp']),
    org: stringOrNull(host['org']),
    as_number: stringOrNull(host['as_number'] ?? host['asNumber'] ?? host['as']),
    city: stringOrNull(host['city']),
    region: stringOrNull(host['region'] ?? host['regionName']),
    country: stringOrNull(host['country']),
  };
}

async function linkHost(
  db: Db,
  domainId: string,
  host: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const columns = hostColumns(host);
  const ip = columns.ip;
  if (!ip) return;

  await db
    .insertInto('hosts')
    .values({ ...columns, ip, user_id: userId })
    .onConflict((conflict) => conflict.columns(['user_id', 'ip']).doNothing())
    .execute();

  const saved = await db
    .selectFrom('hosts')
    .where('user_id', '=', userId)
    .where('ip', '=', ip)
    .select('id')
    .executeTakeFirst();
  if (!saved) return;

  // Drop the old links only once we have a replacement
  await db
    .deleteFrom('domain_hosts')
    .where('domain_id', '=', domainId)
    .where('host_id', '!=', saved.id)
    .execute();

  await db
    .insertInto('domain_hosts')
    .values({ domain_id: domainId, host_id: saved.id })
    .onConflict((conflict) => conflict.columns(['domain_id', 'host_id']).doNothing())
    .execute();
}

const SSL_FIELDS = [
  'issuer',
  'issuer_country',
  'subject',
  'valid_from',
  'valid_to',
  'fingerprint',
  'signature_algorithm',
] as const;

function pickSslFields(ssl: Record<string, unknown>) {
  return {
    ...Object.fromEntries(SSL_FIELDS.map((field) => [field, stringOrNull(ssl[field])])),
    key_size: numberOrNull(ssl['key_size']),
  };
}

const WHOIS_FIELDS = [
  'name',
  'organization',
  'country',
  'street',
  'city',
  'state',
  'postal_code',
] as const;

function pickWhoisFields(whois: Record<string, unknown>) {
  return Object.fromEntries(
    WHOIS_FIELDS.map((field) => [field, stringOrNull(whois[field])]),
  );
}

function stringOrNull(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
