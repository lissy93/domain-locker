import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import {
  isPostgresAvailable,
  resetTestDatabase,
  testPool,
  truncateAll,
} from '../helpers/postgres';

const available = await isPostgresAvailable();
const SELF_HOST_USER = 'a0000000-aaaa-42a0-a0a0-00a000000a69';
const OTHER_USER = 'b0000000-bbbb-42b0-b0b0-00b000000b69';

describe.skipIf(!available)('db/schema.sql', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = testPool(await resetTestDatabase());
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(() => truncateAll(pool));

  it('is idempotent, so start.sh can re-apply it on every boot', async () => {
    await expect(
      pool.query(readFileSync('db/schema.sql', 'utf8')),
    ).resolves.toBeDefined();
  });

  it('declares each table, function and index only once in source', () => {
    const sql = readFileSync('db/schema.sql', 'utf8');
    const declarations = [
      ...sql.matchAll(
        /CREATE (?:OR REPLACE )?(TABLE|FUNCTION|INDEX)(?: IF NOT EXISTS)? "?(?:public"?\.)?"?([a-z_]+)"?/gi,
      ),
    ].map(([, kind, name]) => `${kind.toUpperCase()} ${name}`);

    const duplicated = declarations.filter(
      (entry, index) => declarations.indexOf(entry) !== index,
    );
    expect([...new Set(duplicated)]).toEqual([]);
  });

  it('defines each function exactly once', async () => {
    const { rows } = await pool.query<{ proname: string }>(
      `SELECT proname FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND NOT EXISTS (
           SELECT 1 FROM pg_depend d
           WHERE d.objid = p.oid AND d.deptype = 'e'
         )
       GROUP BY proname HAVING count(*) > 1`,
    );
    expect(rows).toEqual([]);
  });

  it('has a unique constraint on domain_costings.domain_id for upserts', async () => {
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'domain_costings' AND c.contype = 'u'
         AND (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute
              WHERE attrelid = t.oid AND attnum = ANY(c.conkey)) = ARRAY['domain_id']`,
    );
    expect(rows).toHaveLength(1);
  });

  it('forces every host onto the static self-hosted user', async () => {
    const { rows } = await pool.query<{ user_id: string }>(
      `INSERT INTO hosts (ip, user_id) VALUES ('9.9.9.9'::inet, $1) RETURNING user_id`,
      [OTHER_USER],
    );
    expect(rows[0].user_id).toBe(SELF_HOST_USER);
  });

  describe('delete_domain', () => {
    it('removes the domain and every child row', async () => {
      const domainId = await seedDomain(pool, SELF_HOST_USER, 'example.com');
      await seedChildren(pool, domainId, SELF_HOST_USER);

      await pool.query('SELECT delete_domain($1)', [domainId]);

      for (const table of CHILD_TABLES) {
        const { rows } = await pool.query(`SELECT 1 FROM ${table} WHERE domain_id = $1`, [
          domainId,
        ]);
        expect(rows, `${table} still has rows`).toHaveLength(0);
      }
      const { rows } = await pool.query('SELECT 1 FROM domains WHERE id = $1', [
        domainId,
      ]);
      expect(rows).toHaveLength(0);
    });

    it('cleans up the owner orphaned tags, hosts and registrars', async () => {
      const domainId = await seedDomain(pool, SELF_HOST_USER, 'example.com');
      await seedChildren(pool, domainId, SELF_HOST_USER);

      await pool.query('SELECT delete_domain($1)', [domainId]);

      for (const table of ['tags', 'hosts', 'registrars']) {
        const { rows } = await pool.query(`SELECT 1 FROM ${table}`);
        expect(rows, `${table} left orphans`).toHaveLength(0);
      }
    });

    it('keeps tags, hosts and registrars still used by another domain', async () => {
      const keptId = await seedDomain(pool, SELF_HOST_USER, 'kept.com');
      const goneId = await seedDomain(pool, SELF_HOST_USER, 'gone.com');
      const { tagId, hostId } = await seedChildren(pool, keptId, SELF_HOST_USER);
      await pool.query('INSERT INTO domain_tags (domain_id, tag_id) VALUES ($1, $2)', [
        goneId,
        tagId,
      ]);
      await pool.query('INSERT INTO domain_hosts (domain_id, host_id) VALUES ($1, $2)', [
        goneId,
        hostId,
      ]);

      await pool.query('SELECT delete_domain($1)', [goneId]);

      expect((await pool.query('SELECT 1 FROM tags')).rows).toHaveLength(1);
      expect((await pool.query('SELECT 1 FROM hosts')).rows).toHaveLength(1);
      expect((await pool.query('SELECT 1 FROM registrars')).rows).toHaveLength(1);
    });

    it('never touches another user records', async () => {
      const mineId = await seedDomain(pool, SELF_HOST_USER, 'mine.com');
      await seedDomain(pool, OTHER_USER, 'theirs.com');
      await pool.query(`INSERT INTO tags (name, user_id) VALUES ('their-tag', $1)`, [
        OTHER_USER,
      ]);

      await pool.query('SELECT delete_domain($1)', [mineId]);

      const { rows } = await pool.query(
        `SELECT (SELECT count(*) FROM tags WHERE user_id = $1)::int AS tags,
                (SELECT count(*) FROM registrars WHERE user_id = $1)::int AS registrars`,
        [OTHER_USER],
      );
      expect(rows[0]).toEqual({ tags: 1, registrars: 1 });
    });

    it('is a no-op for an unknown domain', async () => {
      await expect(
        pool.query('SELECT delete_domain($1)', ['00000000-0000-4000-8000-000000000000']),
      ).resolves.toBeDefined();
    });
  });
});

const CHILD_TABLES = [
  'notifications',
  'domain_tags',
  'ip_addresses',
  'ssl_certificates',
  'whois_info',
  'dns_records',
  'domain_costings',
  'domain_statuses',
  'uptime',
  'sub_domains',
  'domain_updates',
  'notification_preferences',
  'domain_links',
  'domain_hosts',
];

async function seedDomain(pool: Pool, userId: string, name: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `WITH r AS (
       INSERT INTO registrars (name, user_id) VALUES ($2, $1) RETURNING id
     )
     INSERT INTO domains (user_id, domain_name, registrar_id)
     VALUES ($1, $3, (SELECT id FROM r)) RETURNING id`,
    [userId, `Registrar for ${name}`, name],
  );
  return rows[0].id;
}

async function seedChildren(pool: Pool, domainId: string, userId: string) {
  const tagId = (
    await pool.query<{ id: string }>(
      `INSERT INTO tags (name, user_id) VALUES ('seed-tag-' || $2, $1) RETURNING id`,
      [userId, domainId],
    )
  ).rows[0].id;
  const hostId = (
    await pool.query<{ id: string }>(
      `INSERT INTO hosts (ip, user_id) VALUES ('1.1.1.1'::inet, $1) RETURNING id`,
      [userId],
    )
  ).rows[0].id;

  const inserts: [string, unknown[]][] = [
    ['INSERT INTO domain_tags (domain_id, tag_id) VALUES ($1, $2)', [domainId, tagId]],
    ['INSERT INTO domain_hosts (domain_id, host_id) VALUES ($1, $2)', [domainId, hostId]],
    [
      `INSERT INTO notifications (user_id, domain_id, change_type, message)
       VALUES ($2, $1, 'test', 'msg')`,
      [domainId, userId],
    ],
    [
      `INSERT INTO ip_addresses (domain_id, ip_address, is_ipv6)
       VALUES ($1, '1.2.3.4'::inet, false)`,
      [domainId],
    ],
    [
      `INSERT INTO ssl_certificates (domain_id, issuer) VALUES ($1, 'Test CA')`,
      [domainId],
    ],
    [`INSERT INTO whois_info (domain_id, country) VALUES ($1, 'GB')`, [domainId]],
    [
      `INSERT INTO dns_records (domain_id, record_type, record_value)
       VALUES ($1, 'A', '1.2.3.4')`,
      [domainId],
    ],
    [
      'INSERT INTO domain_costings (domain_id, purchase_price) VALUES ($1, 10)',
      [domainId],
    ],
    [
      `INSERT INTO domain_statuses (domain_id, status_code) VALUES ($1, 'clientHold')`,
      [domainId],
    ],
    ['INSERT INTO uptime (domain_id, is_up) VALUES ($1, true)', [domainId]],
    [`INSERT INTO sub_domains (domain_id, name) VALUES ($1, 'www')`, [domainId]],
    [
      `INSERT INTO domain_updates (domain_id, user_id, change, change_type)
       VALUES ($1, $2, 'changed', 'test')`,
      [domainId, userId],
    ],
    [
      `INSERT INTO notification_preferences (domain_id, notification_type, is_enabled)
       VALUES ($1, 'test', true)`,
      [domainId],
    ],
    [
      `INSERT INTO domain_links (domain_id, link_name, link_url)
       VALUES ($1, 'Docs', 'https://example.com')`,
      [domainId],
    ],
  ];
  for (const [sql, params] of inserts) await pool.query(sql, params);
  return { tagId, hostId };
}
