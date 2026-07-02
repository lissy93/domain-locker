import { SupabaseClient, User } from '@supabase/supabase-js';
import { catchError, concatMap, forkJoin, from, map, Observable, switchMap } from 'rxjs';
import { Tag } from '~/app/../types/Database';

interface TagRow {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  user_id?: string;
  domain_tags?: { domain_id: string }[];
}

export class TagQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<User | null>,
  ) {}

  addTag(tag: Omit<Tag, 'id'>): Observable<Tag> {
    return from(this.supabase.from('tags').insert(tag).single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Failed to add tag');
        return data as Tag;
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getTag(tagName: string): Observable<Tag> {
    return from(this.supabase.from('tags').select('*').eq('name', tagName).single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Tag not found');
        return data as Tag;
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getTags(): Observable<Tag[]> {
    return from(this.supabase.from('tags').select('*')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Tag[];
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  async saveTags(domainId: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    const userId = await this.getCurrentUser().then((user) => user?.id);
    if (!userId) throw new Error('User must be authenticated to save tags.');

    for (const tag of tags) {
      // Try to insert the tag with the user_id
      const { data: savedTag, error: tagError } = await this.supabase
        .from('tags')
        .insert({ name: tag, user_id: userId })
        .select('id')
        .single();

      let tagId: string;

      if (savedTag) {
        tagId = savedTag.id;
      } else {
        // If the tag already exists, fetch its ID
        if (tagError?.code === '23505') {
          // Duplicate key violation
          const { data: existingTag, error: fetchError } = await this.supabase
            .from('tags')
            .select('id')
            .eq('name', tag)
            .eq('user_id', userId) // Ensure the existing tag belongs to the user
            .single();
          if (fetchError) throw fetchError;
          if (!existingTag) throw new Error(`Failed to fetch existing tag: ${tag}`);
          tagId = existingTag.id;
        } else {
          throw tagError;
        }
      }

      // Link the tag to the domain
      const { error: linkError } = await this.supabase
        .from('domain_tags')
        .insert({ domain_id: domainId, tag_id: tagId });

      if (linkError) throw linkError;
    }
  }

  getTagsWithDomainCounts(): Observable<(TagRow & { domain_count: number })[]> {
    return from(
      this.supabase.from('tags').select(`
          id,
          name,
          color,
          icon,
          description,
          domain_tags (
            domain_id
          )
        `),
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }
        return (data || []).map((tag) => ({
          ...tag,
          domain_count: tag.domain_tags.length,
        }));
      }),
      catchError((err) => {
        // handleError can either throw or return a throwError observable
        // e.g., return throwError(() => err)
        return this.handleError(err);
      }),
    );
  }

  // Replace a domain's tags, creating any new tags for the current user
  async updateTags(domainId: string, tags: string[]): Promise<void> {
    const userId = await this.getCurrentUser().then((user) => user?.id);
    if (!userId) throw new Error('User must be authenticated to update tags.');

    // Clear existing links before re-adding
    await this.supabase.from('domain_tags').delete().eq('domain_id', domainId);

    for (const tagName of tags) {
      const { data: existingTag } = await this.supabase
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .eq('user_id', userId)
        .maybeSingle();

      let tagId: string;
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag, error: insertError } = await this.supabase
          .from('tags')
          .insert({ name: tagName, user_id: userId })
          .select('id')
          .single();
        if (insertError) throw insertError;
        tagId = newTag.id;
      }

      const { error: linkError } = await this.supabase
        .from('domain_tags')
        .insert({ domain_id: domainId, tag_id: tagId });
      if (linkError) throw linkError;
    }
  }

  createTag(tag: Tag): Observable<unknown> {
    return from(
      this.getCurrentUser().then((user) => {
        if (!user) throw new Error('User must be authenticated to create a tag.');
        return this.supabase
          .from('tags')
          .insert([
            {
              name: tag.name,
              color: tag.color || null,
              icon: tag.icon || null,
              description: tag.description || null,
              user_id: user.id,
            },
          ])
          .single();
      }),
    );
  }

  updateTag(tag: Tag): Observable<void> {
    return from(
      this.supabase
        .from('tags')
        .update({
          name: tag.name,
          color: tag.color || null,
          description: tag.description || null,
          icon: tag.icon || null,
        })
        .eq(tag.id ? 'id' : 'name', tag.id || tag.name),
    ).pipe(
      map(({ error }) => {
        if (error) {
          throw error;
        }
      }),
      catchError((error) => {
        this.handleError(error);
        return [];
      }),
    );
  }

  // Fetch all available domains and the selected domains for a given tag
  getDomainsForTag(
    tagId: string,
  ): Observable<{ available: Record<string, unknown>[]; selected: unknown[] }> {
    return forkJoin({
      available: from(this.supabase.from('domains').select('*')).pipe(
        map(({ data }) => (data || []) as Record<string, unknown>[]),
      ),

      selected: from(
        this.supabase
          .from('domain_tags')
          .select('domains (domain_name, id)')
          .eq('tag_id', tagId),
      ).pipe(map(({ data }) => (data || []).map((d) => d.domains))),
    });
  }

  deleteTag(id: string): Observable<void> {
    return from(this.supabase.from('domain_tags').delete().eq('tag_id', id)).pipe(
      concatMap(() => this.supabase.from('tags').delete().eq('id', id)),
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  // Save domains associated with a tag
  saveDomainsForTag(tagId: string, selectedDomains: { id: string }[]): Observable<void> {
    // Fetch existing associations first
    return from(
      this.supabase.from('domain_tags').select('domain_id').eq('tag_id', tagId),
    ).pipe(
      map(({ data }) =>
        (data || []).map((item: { domain_id: string }) => item.domain_id),
      ),
      switchMap((existingDomains: string[]) => {
        // Identify domains to add and remove
        const domainIdsToAdd = selectedDomains
          .filter((domain) => !existingDomains.includes(domain.id))
          .map((domain) => ({ domain_id: domain.id, tag_id: tagId }));

        const domainIdsToRemove = existingDomains.filter(
          (domainId) => !selectedDomains.some((domain) => domain.id === domainId),
        );

        // Perform insert and delete operations
        const addDomains = domainIdsToAdd.length
          ? this.supabase.from('domain_tags').insert(domainIdsToAdd)
          : Promise.resolve();

        const removeDomains = domainIdsToRemove.length
          ? this.supabase
              .from('domain_tags')
              .delete()
              .in('domain_id', domainIdsToRemove)
              .eq('tag_id', tagId)
          : Promise.resolve();

        return forkJoin([from(addDomains), from(removeDomains)]).pipe(
          map(() => undefined as void),
        );
      }),
    );
  }

  getDomainCountsByTag(): Observable<Record<string, number>> {
    return from(
      this.supabase
        .from('domain_tags')
        .select('tags(name), domain_id', { count: 'exact' })
        .select('domain_id')
        .select('tags(name)'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const counts: Record<string, number> = {};
        const rows = (data || []) as unknown as { tags?: { name?: string } | null }[];
        rows.forEach((item) => {
          const tagName = item.tags?.name;
          if (tagName) counts[tagName] = (counts[tagName] || 0) + 1;
        });
        return counts;
      }),
      catchError((error) => this.handleError(error)),
    );
  }
}
