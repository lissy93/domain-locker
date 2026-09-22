import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import type { DeletableTable } from '../../../db/repos/admin';

const schema = z.object({ tables: z.array(z.string()).optional() });

export default defineApiRoute({ write: true, body: schema }, async ({ db, body }) => {
  const allowed = new Set<string>(db.admin.deletableTables);
  const tables = body.tables?.filter((table) => allowed.has(table)) as
    | DeletableTable[]
    | undefined;
  await db.admin.deleteAllData(tables?.length ? tables : undefined);
  return { deleted: true };
});
