import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { isPostgresAvailable, resetTestDatabase, testPool } from '../helpers/postgres';

/**
 * delete_domain as it shipped before 0.2.5: the parameter shadows the column,
 * so every call failed with "column reference domain_id is ambiguous".
 * Pinned here rather than read from git, so this stays a fixed starting point.
 */
const LEGACY_DELETE_DOMAIN = `
CREATE OR REPLACE FUNCTION "public"."delete_domain"("domain_id" uuid) RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM notifications WHERE domain_id = $1;
  DELETE FROM domains WHERE id = $1;
END;
$$;`;

const available = await isPostgresAvailable();

describe.skipIf(!available)('upgrading an existing database', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = testPool(await resetTestDatabase('dl_test_upgrade'));
    await pool.query(LEGACY_DELETE_DOMAIN);
  });

  afterAll(() => pool?.end());

  it('starts from a database where delete_domain is broken', async () => {
    const domainId = await seedDomain(pool);
    await expect(pool.query('SELECT delete_domain($1)', [domainId])).rejects.toThrow(
      /ambiguous/,
    );
  });

  it('heals when start.sh re-applies the current schema, keeping existing rows', async () => {
    const domainId = await seedDomain(pool);

    await pool.query(readFileSync('db/schema.sql', 'utf8'));

    const kept = await pool.query('SELECT 1 FROM domains WHERE id = $1', [domainId]);
    expect(kept.rows).toHaveLength(1);

    await expect(
      pool.query('SELECT delete_domain($1)', [domainId]),
    ).resolves.toBeDefined();
    const remaining = await pool.query('SELECT 1 FROM domains WHERE id = $1', [domainId]);
    expect(remaining.rows).toHaveLength(0);
  });
});

let seedCounter = 0;

async function seedDomain(pool: Pool): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO domains (user_id, domain_name)
     VALUES ('a0000000-aaaa-42a0-a0a0-00a000000a69', $1) RETURNING id`,
    [`upgrade-${seedCounter++}.com`],
  );
  return rows[0].id;
}
