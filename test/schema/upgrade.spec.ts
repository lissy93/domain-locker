import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { isPostgresAvailable, resetTestDatabase, testPool } from '../helpers/postgres';

/** The schema as shipped in the last release, to simulate an existing install */
function releasedSchema(): string | null {
  try {
    return execFileSync('git', ['show', 'HEAD:db/schema.sql'], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

const previousSchema = releasedSchema();
const available = await isPostgresAvailable();

describe.skipIf(!available || !previousSchema)('upgrading an existing database', () => {
  let pool: Pool;

  beforeAll(async () => {
    const config = await resetTestDatabase('dl_test_upgrade');
    pool = testPool(config);
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(previousSchema as string);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('starts from a database where delete_domain is broken', async () => {
    const domainId = await seedDomain(pool);
    await expect(pool.query('SELECT delete_domain($1)', [domainId])).rejects.toThrow(
      /ambiguous/,
    );
  });

  it('heals when start.sh re-applies the current schema, keeping existing rows', async () => {
    const domainId = await seedDomain(pool);

    await pool.query(readFileSync('db/schema.sql', 'utf8'));

    const { rows: kept } = await pool.query('SELECT 1 FROM domains WHERE id = $1', [
      domainId,
    ]);
    expect(kept).toHaveLength(1);

    await expect(
      pool.query('SELECT delete_domain($1)', [domainId]),
    ).resolves.toBeDefined();
    const { rows } = await pool.query('SELECT 1 FROM domains WHERE id = $1', [domainId]);
    expect(rows).toHaveLength(0);
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
