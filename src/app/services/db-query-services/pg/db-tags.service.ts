import { catchError, concatMap, forkJoin, map, Observable, switchMap } from 'rxjs';
import { Tag } from '~/app/../types/Database';
import { PgApiUtilService } from '~/app/utils/pg-api.util';

interface TagRow {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  user_id?: string;
}

export class TagQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => Observable<never>,
    private getCurrentUser: () => Promise<{ id: string } | null>,
  ) {}

  addTag(tag: Omit<Tag, 'id'>): Observable<Tag> {
    const query = `
      INSERT INTO tags (name, color, icon, description, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const params = [
      tag.name,
      tag.color || null,
      tag.icon || null,
      tag.description || null,
    ];
    return this.pgApiUtil.postToPgExecutor(query, params).pipe(
      map((response) => response.data[0] as Tag),
      catchError((error) => this.handleError(error)),
    );
  }

  getTag(tagName: string): Observable<Tag> {
    const query = `SELECT * FROM tags WHERE name = $1`;
    return this.pgApiUtil.postToPgExecutor(query, [tagName]).pipe(
      map((response) => {
        if (!response.data.length) throw new Error('Tag not found');
        return response.data[0] as Tag;
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  getTags(): Observable<Tag[]> {
    const query = `SELECT * FROM tags`;
    return this.pgApiUtil.postToPgExecutor(query).pipe(
      map((response) => response.data as Tag[]),
      catchError((error) => this.handleError(error)),
    );
  }

  async saveTags(domainId: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    const user = await this.getCurrentUser();
    if (!user || !user.id) throw new Error('User must be authenticated to save tags.');
    const userId = user.id;

    // Ensure unique constraint exists: tags(name, user_id)
    const insertTagsQuery = `
      INSERT INTO tags (name, user_id)
      VALUES ${tags.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')}
      ON CONFLICT (name, user_id) DO NOTHING
      RETURNING id, name
    `;
    const tagParams = tags.flatMap((tag) => [tag, userId]);

    // Insert tags and get their IDs
    const insertResult = await this.pgApiUtil
      .postToPgExecutor<{ id: string; name: string }>(insertTagsQuery, tagParams)
      .toPromise();
    const insertedTags = insertResult?.data || [];

    // Fetch missing tags
    const missingTags = tags.filter((tag) => !insertedTags.some((t) => t.name === tag));
    const selectTagsQuery = `SELECT id, name FROM tags WHERE name = ANY($1) AND user_id = $2`;
    const selectResult = await this.pgApiUtil
      .postToPgExecutor<{
        id: string;
        name: string;
      }>(selectTagsQuery, [missingTags, userId])
      .toPromise();
    const selectedTags = selectResult?.data || [];

    // Combine all tag IDs
    const allTags = [...insertedTags, ...selectedTags];

    // Link tags to domain
    const linkTagsQuery = `
      INSERT INTO domain_tags (domain_id, tag_id)
      VALUES ${allTags.map((_, i) => `($1, $${i + 2})`).join(', ')}
      ON CONFLICT DO NOTHING
    `;
    const linkParams = [domainId, ...allTags.map((t) => t.id)];
    await this.pgApiUtil.postToPgExecutor(linkTagsQuery, linkParams).toPromise();
  }

  getTagsWithDomainCounts(): Observable<(TagRow & { domain_count: number })[]> {
    const query = `
      SELECT tags.*, COUNT(domain_tags.domain_id) AS domain_count
      FROM tags
      LEFT JOIN domain_tags ON tags.id = domain_tags.tag_id
      GROUP BY tags.id
    `;
    return this.pgApiUtil.postToPgExecutor<TagRow & { domain_count: number }>(query).pipe(
      map((response) => response.data),
      catchError((error) => this.handleError(error)),
    );
  }

  async updateTags(domainId: string, tags: string[]): Promise<void> {
    const deleteQuery = `DELETE FROM domain_tags WHERE domain_id = $1`;
    await this.pgApiUtil.postToPgExecutor(deleteQuery, [domainId]).toPromise();

    await this.saveTags(domainId, tags);
  }

  createTag(tag: Tag): Observable<{ data: TagRow[] } | unknown> {
    const query = `
      INSERT INTO tags (name, color, icon, description, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    return new Observable((observer) => {
      this.getCurrentUser()
        .then((user) => {
          if (!user) {
            observer.error(new Error('User must be authenticated to create a tag.'));
            return;
          }
          this.pgApiUtil
            .postToPgExecutor(query, [
              tag.name,
              tag.color || null,
              tag.icon || null,
              tag.description || null,
              user.id,
            ])
            .subscribe({
              next: (result) => observer.next(result),
              error: (error) => observer.error(error),
              complete: () => observer.complete(),
            });
        })
        .catch((error) => observer.error(error));
    }).pipe(catchError((error) => this.handleError(error)));
  }

  updateTag(tag: Tag): Observable<void> {
    const query = `
      UPDATE tags
      SET name = $1, color = $2, description = $3, icon = $4
      WHERE name = $1
    `;
    return this.pgApiUtil
      .postToPgExecutor(query, [
        tag.name,
        tag.color || null,
        tag.description || null,
        tag.icon || null,
      ])
      .pipe(
        map(() => undefined),
        catchError((error) => this.handleError(error)),
      );
  }

  getDomainsForTag(tagId: string): Observable<{
    available: Record<string, unknown>[];
    selected: Record<string, unknown>[];
  }> {
    const availableQuery = `SELECT * FROM domains`;
    const selectedQuery = `
      SELECT d.domain_name, d.id
      FROM domain_tags dt
      INNER JOIN domains d ON dt.domain_id = d.id
      WHERE dt.tag_id = $1
    `;
    return forkJoin({
      available: this.pgApiUtil
        .postToPgExecutor<Record<string, unknown>>(availableQuery)
        .pipe(map((response) => response.data || [])),
      selected: this.pgApiUtil
        .postToPgExecutor<Record<string, unknown>>(selectedQuery, [tagId])
        .pipe(map((response) => response.data || [])),
    });
  }

  deleteTag(id: string): Observable<void> {
    const deleteDomainTagsQuery = `DELETE FROM domain_tags WHERE tag_id = $1`;
    const deleteTagQuery = `DELETE FROM tags WHERE id = $1`;
    return this.pgApiUtil.postToPgExecutor(deleteDomainTagsQuery, [id]).pipe(
      concatMap(() => this.pgApiUtil.postToPgExecutor(deleteTagQuery, [id])),
      map(() => undefined),
      catchError((error) => this.handleError(error)),
    );
  }

  saveDomainsForTag(tagId: string, selectedDomains: { id: string }[]): Observable<void> {
    const fetchExistingQuery = `SELECT domain_id FROM domain_tags WHERE tag_id = $1`;
    return this.pgApiUtil
      .postToPgExecutor<{ domain_id: string }>(fetchExistingQuery, [tagId])
      .pipe(
        map((response) => response.data.map((item) => item.domain_id)),
        switchMap((existingDomains) => {
          const domainsToAdd = selectedDomains.filter(
            (domain) => !existingDomains.includes(domain.id),
          );
          const domainsToRemove = existingDomains.filter(
            (domainId) => !selectedDomains.some((domain) => domain.id === domainId),
          );

          const addQueries = domainsToAdd.map((domain) =>
            this.pgApiUtil.postToPgExecutor(
              `INSERT INTO domain_tags (domain_id, tag_id) VALUES ($1, $2)`,
              [domain.id, tagId],
            ),
          );

          const removeQueries = domainsToRemove.length
            ? [
                this.pgApiUtil.postToPgExecutor(
                  `DELETE FROM domain_tags WHERE domain_id = ANY($1) AND tag_id = $2`,
                  [domainsToRemove, tagId],
                ),
              ]
            : [];

          return forkJoin([...addQueries, ...removeQueries]).pipe(map(() => undefined));
        }),
      );
  }

  getDomainCountsByTag(): Observable<Record<string, number>> {
    const query = `
      SELECT t.name, COUNT(dt.domain_id) AS domain_count
      FROM tags t
      LEFT JOIN domain_tags dt ON t.id = dt.tag_id
      GROUP BY t.name
    `;
    return this.pgApiUtil
      .postToPgExecutor<{ name: string; domain_count: number }>(query)
      .pipe(
        map((response) => {
          const counts: Record<string, number> = {};
          response.data.forEach((item) => {
            counts[item.name] = item.domain_count;
          });
          return counts;
        }),
        catchError((error) => this.handleError(error)),
      );
  }
}
