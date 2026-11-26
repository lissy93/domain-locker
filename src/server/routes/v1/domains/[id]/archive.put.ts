import { z } from 'zod';
import { defineApiRoute } from '../../../../lib/handler';
import { notFound } from '../../../../lib/errors';

export default defineApiRoute(
  { write: true, body: z.object({ archived: z.boolean() }) },
  async ({ db, body, uuidParam }) => {
    if (!(await db.domains.setArchived(uuidParam('id'), body.archived))) {
      throw notFound('Domain');
    }
    return { archived: body.archived };
  },
);
