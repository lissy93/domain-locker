import { SupabaseClient } from '@supabase/supabase-js';
import { catchError, from, map, Observable, switchMap } from 'rxjs';
import { Link } from '~/app/../types/Database';
import { LinkResponse, ModifiedLink } from '~/app/pages/assets/links/index.page';

interface LinkRow {
  id: string;
  link_name: string;
  link_url: string;
  link_description?: string;
  domains?: { domain_name?: string } | null;
}

interface LinkDomainAggregate {
  link_name: string;
  link_url: string;
  link_description?: string;
  link_ids: Set<string>;
  domains: Set<string>;
}

export class LinkQueries {
  constructor(
    private supabase: SupabaseClient,
    private handleError: (error: unknown) => Observable<never>,
    private listDomainNames: () => Observable<string[]>,
  ) {}

  async updateLinks(domainId: string, links: Link[]): Promise<void> {
    // Get existing links from the database
    const { data: existingData, error } = await this.supabase
      .from('domain_links')
      .select('id, link_name, link_url, link_description')
      .eq('domain_id', domainId);

    if (error) throw error;

    const existingLinks = existingData || [];

    // Determine which links to add, update, and delete
    const linksToAdd = links.filter(
      (newLink) =>
        !existingLinks.some(
          (existingLink) =>
            existingLink.link_name === newLink.link_name &&
            existingLink.link_url === newLink.link_url,
        ),
    );

    const linksToRemove = existingLinks.filter(
      (existingLink) =>
        !links.some(
          (newLink) =>
            newLink.link_name === existingLink.link_name &&
            newLink.link_url === existingLink.link_url,
        ),
    );

    const linksToUpdate = links.filter((newLink) =>
      existingLinks.some(
        (existingLink) =>
          existingLink.link_name === newLink.link_name &&
          (existingLink.link_url !== newLink.link_url ||
            existingLink.link_description !== newLink.link_description),
      ),
    );

    // Add new links
    if (linksToAdd.length > 0) {
      const { error: insertError } = await this.supabase
        .from('domain_links')
        .insert(linksToAdd.map((link) => ({ ...link, domain_id: domainId })));
      if (insertError) throw insertError;
    }

    // Update modified links
    for (const link of linksToUpdate) {
      const { error: updateError } = await this.supabase
        .from('domain_links')
        .update({
          link_url: link.link_url,
          link_description: link.link_description,
        })
        .eq('domain_id', domainId)
        .eq('link_name', link.link_name);
      if (updateError) throw updateError;
    }

    // Remove old links
    if (linksToRemove.length > 0) {
      const { error: deleteError } = await this.supabase
        .from('domain_links')
        .delete()
        .eq('domain_id', domainId)
        .in(
          'link_name',
          linksToRemove.map((link) => link.link_name),
        );
      if (deleteError) throw deleteError;
    }
  }

  getAllLinks(): Observable<LinkResponse> {
    return from(
      this.supabase
        .from('domain_links')
        .select(
          `
          id,
          link_name,
          link_url,
          link_description,
          domains(domain_name)
        `,
        )
        .then(({ data, error }) => {
          if (error) throw error;

          // Group links by domain
          const groupedByDomain = (data as unknown as LinkRow[]).reduce(
            (acc: Record<string, Link[]>, link) => {
              const domainName = link.domains?.domain_name || 'Unknown Domain';
              if (!acc[domainName]) acc[domainName] = [];
              acc[domainName].push({
                id: link.id,
                link_name: link.link_name,
                link_url: link.link_url,
                link_description: link.link_description,
              });
              return acc;
            },
            {},
          );

          // Aggregate domains and link IDs for each unique link grouped by link_url
          const linkDomains = (data as unknown as LinkRow[]).reduce(
            (acc: Record<string, LinkDomainAggregate>, link) => {
              const key = link.link_url; // Group by link_url
              if (!acc[key]) {
                acc[key] = {
                  link_name: link.link_name,
                  link_url: link.link_url,
                  link_description: link.link_description,
                  link_ids: new Set(),
                  domains: new Set(),
                };
              }
              acc[key].link_ids.add(link.id); // Add the link ID
              if (link.domains?.domain_name)
                acc[key].domains.add(link.domains.domain_name); // Add the domain
              return acc;
            },
            {},
          );

          // Map aggregated data into the required format
          const linksWithDomains = Object.values(linkDomains).map(
            ({ link_name, link_url, link_description, link_ids, domains }) => ({
              id: undefined,
              link_name,
              link_url,
              link_description,
              link_ids: Array.from(link_ids), // Convert link_ids set to array
              domains: Array.from(domains), // Convert domains set to array
            }),
          );

          return { groupedByDomain, linksWithDomains };
        }),
    ).pipe(catchError((error) => this.handleError(error)));
  }

  addLinkToDomains(linkData: {
    link_name?: string;
    link_url?: string;
    link_description?: string;
    domains?: string[];
  }): Observable<void> {
    const { link_name, link_url, link_description, domains } = linkData;

    return this.listDomainNames().pipe(
      switchMap((availableDomains) => {
        // Filter valid domains that exist in the database
        const validDomains = (domains || []).filter((domain) =>
          availableDomains.includes(domain),
        );

        // Fetch the domain IDs for the valid domains
        return from(
          this.supabase
            .from('domains')
            .select('id, domain_name')
            .in('domain_name', validDomains),
        ).pipe(
          map(({ data, error }) => {
            if (error) throw error;
            return data?.map((domain) => domain.id) || [];
          }),
        );
      }),
      switchMap((domainIds: string[]) => {
        if (domainIds.length === 0) {
          throw new Error('No valid domains found to associate with the link.');
        }

        // Prepare link objects for insertion
        const linksToInsert = domainIds.map((domainId) => ({
          domain_id: domainId,
          link_name,
          link_url,
          link_description,
        }));

        // Insert the links into the domain_links table
        return from(this.supabase.from('domain_links').insert(linksToInsert)).pipe(
          map(({ error }) => {
            if (error) throw error;
          }),
        );
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  updateLinkInDomains(linkData: ModifiedLink): Observable<void> {
    const { link_ids, link_name, link_url, link_description, domains } = linkData;

    return this.listDomainNames().pipe(
      switchMap((availableDomains) => {
        // Ensure only valid domains are considered
        const validDomains = (domains || []).filter((domain) =>
          availableDomains.includes(domain),
        );

        // Fetch the domain IDs for the valid domains
        return from(
          this.supabase
            .from('domains')
            .select('id, domain_name')
            .in('domain_name', validDomains),
        ).pipe(
          map(({ data, error }) => {
            if (error) throw error;
            return (
              data?.map((domain) => ({
                domainId: domain.id,
                domainName: domain.domain_name,
              })) || []
            );
          }),
        );
      }),
      switchMap(async (domainData) => {
        if (!link_ids) return;
        const { data: existingLinks, error } = await this.supabase
          .from('domain_links')
          .select('id, domain_id')
          .in('id', link_ids);

        if (error) throw error;

        const existingDomainIds = existingLinks?.map((link) => link.domain_id) || [];

        const domainsToAdd = domainData.filter(
          (d) => !existingDomainIds.includes(d.domainId),
        );
        const domainsToUpdate = domainData.filter((d) =>
          existingDomainIds.includes(d.domainId),
        );
        const domainsToRemove = existingDomainIds.filter(
          (id) => !domainData.some((d) => d.domainId === id),
        );

        const tasks: PromiseLike<unknown>[] = [];

        // Add new links
        if (domainsToAdd.length > 0) {
          tasks.push(
            this.supabase
              .from('domain_links')
              .insert(
                domainsToAdd.map((d) => ({
                  domain_id: d.domainId,
                  link_name,
                  link_url,
                  link_description,
                })),
              )
              .then(({ error }) => {
                if (error) throw error;
              }),
          );
        }

        // Update existing links
        for (const domain of domainsToUpdate) {
          tasks.push(
            this.supabase
              .from('domain_links')
              .update({
                link_name,
                link_url,
                link_description,
              })
              .eq('domain_id', domain.domainId)
              .eq(
                'id',
                link_ids.find((id) => existingLinks.some((link) => link.id === id)),
              ),
          );
        }

        // Remove links for unchecked domains
        if (domainsToRemove.length > 0) {
          tasks.push(
            this.supabase
              .from('domain_links')
              .delete()
              .in('domain_id', domainsToRemove)
              .then(({ error }) => {
                if (error) throw error;
              }),
          );
        }
        await Promise.all(tasks);
      }),
      map(() => void 0),
      catchError((error) => this.handleError(error)),
    );
  }

  deleteLinks(linkIds: string | string[]): Observable<void> {
    const ids = Array.isArray(linkIds) ? linkIds : [linkIds];
    return from(
      this.supabase.from('domain_links').delete().in('id', ids), // Use 'in' to delete multiple IDs
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => this.handleError(error)),
    );
  }
}
