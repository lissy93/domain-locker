import { z } from 'zod';
import { defineApiRoute } from '../../../lib/handler';
import type { AssetType } from '../../../db/repos/domains';

const schema = z.object({
  type: z.enum([
    'domains',
    'registrars',
    'tags',
    'hosts',
    'ip_addresses',
    'ssl_certificates',
    'dns_records',
    'links',
    'subdomains',
  ]),
});

export default defineApiRoute({ query: schema }, async ({ db, query }) => ({
  total: await db.domains.assetCount(query.type as AssetType),
}));
