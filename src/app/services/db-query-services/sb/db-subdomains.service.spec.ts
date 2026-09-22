import type { SupabaseClient } from '@supabase/supabase-js';
import { throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { SubdomainsQueries } from '~/app/services/db-query-services/sb/db-subdomains.service';

/** Just enough of the Supabase client to record what a save would have written */
function fakeSupabase(existing: { name: string }[] = []) {
  const inserted: Record<string, unknown>[][] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: existing, error: null }) }),
      insert: (rows: Record<string, unknown>[]) => {
        inserted.push(rows);
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

const queriesFor = (supabase: SupabaseClient) =>
  new SubdomainsQueries(
    supabase,
    (error) => throwError(() => error),
    {} as GlobalMessageService,
  );

/**
 * Saving a domain saves its subdomains alongside it, so treating "there are
 * none" as a failure would report a successful add as a broken one
 */
describe('SubdomainsQueries.saveSubdomains', () => {
  it('does nothing when there are no subdomains', async () => {
    const { client, inserted } = fakeSupabase();
    await expect(queriesFor(client).saveSubdomains('d1', [])).resolves.toBeUndefined();
    expect(inserted).toEqual([]);
  });

  it('does nothing when every subdomain is blank', async () => {
    const { client, inserted } = fakeSupabase();
    await queriesFor(client).saveSubdomains('d1', [{ name: ' ' }, { name: '' }]);
    expect(inserted).toEqual([]);
  });

  it('does nothing when the subdomains are already saved', async () => {
    const { client, inserted } = fakeSupabase([{ name: 'www' }]);
    await queriesFor(client).saveSubdomains('d1', [{ name: 'www' }]);
    expect(inserted).toEqual([]);
  });

  it('inserts the ones that are new', async () => {
    const { client, inserted } = fakeSupabase([{ name: 'www' }]);
    await queriesFor(client).saveSubdomains('d1', [
      { name: 'www' },
      { name: 'mail', sd_info: '{"type":"A"}' },
    ]);
    expect(inserted).toEqual([
      [{ domain_id: 'd1', name: 'mail', sd_info: '{"type":"A"}' }],
    ]);
  });
});
