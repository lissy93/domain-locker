import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import { ASSET_TYPES } from '../../../../types/common';

const schema = z.object({ type: z.enum(ASSET_TYPES) });

export default defineApiRoute({ query: schema }, async ({ db, query }) => ({
  total: await db.domains.assetCount(query.type),
}));
