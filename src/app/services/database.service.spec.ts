import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DatabaseService from '~/app/services/database.service';
import ApiDatabaseService from '~/app/services/db-query-services/api-database.service';
import SbDatabaseService from '~/app/services/db-query-services/sb-database.service';
import { EnvService } from '~/app/services/environment.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import type { DbDomain } from '~/app/../types/Database';

const domain = (name: string) => ({ id: name, domain_name: name }) as unknown as DbDomain;

/** Stands in for the real backend, returning whatever the test last stored */
function makeBackend() {
  const backend = {
    rows: [domain('first.com')],
    listDomains: vi.fn(() => of(backend.rows)),
    saveDomain: vi.fn(() => of(domain('added.com'))),
    getTotalDomains: vi.fn(() => of(1)),
    deleteAllData: vi.fn(() => Promise.resolve()),
    tagQueries: {
      getTags: vi.fn(() => of([])),
      updateTag: vi.fn(() => of(undefined)),
    },
  };
  return backend;
}

describe('DatabaseService domain cache', () => {
  let backend: ReturnType<typeof makeBackend>;
  let service: DatabaseService;

  beforeEach(() => {
    backend = makeBackend();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiDatabaseService, useValue: backend },
        { provide: SbDatabaseService, useValue: backend },
        { provide: EnvService, useValue: { isSelfHostedDatabase: () => true } },
        { provide: ErrorHandlerService, useValue: { handleError: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    service = TestBed.inject(DatabaseService);
  });

  it('fetches the domain list once and shares it between readers', async () => {
    await firstValueFrom(service.domains$);
    await firstValueFrom(service.domains$);
    expect(backend.listDomains).toHaveBeenCalledOnce();
  });

  it('refetches after a domain is saved', async () => {
    expect(await firstValueFrom(service.domains$)).toHaveLength(1);

    backend.rows = [domain('first.com'), domain('added.com')];
    await firstValueFrom(service.instance.saveDomain({} as never));

    expect(await firstValueFrom(service.domains$)).toHaveLength(2);
    expect(backend.listDomains).toHaveBeenCalledTimes(2);
  });

  it('refetches after a write made through a query group', async () => {
    await firstValueFrom(service.domains$);

    backend.rows = [domain('first.com'), domain('retagged.com')];
    await firstValueFrom(service.instance.tagQueries.updateTag({ id: 't1' } as never));

    expect(await firstValueFrom(service.domains$)).toHaveLength(2);
  });

  it('refetches after a write that returns a promise', async () => {
    await firstValueFrom(service.domains$);

    backend.rows = [];
    await service.instance.deleteAllData('user');

    expect(await firstValueFrom(service.domains$)).toEqual([]);
  });

  it('keeps the cache for reads, so a query group getter does not clear it', async () => {
    await firstValueFrom(service.domains$);
    await firstValueFrom(service.instance.tagQueries.getTags());
    await firstValueFrom(service.domains$);
    expect(backend.listDomains).toHaveBeenCalledOnce();
  });

  it('returns the same wrapped query group each time it is read', () => {
    expect(service.instance.tagQueries).toBe(service.instance.tagQueries);
  });

  it('clears the cache before the caller is told the write finished', async () => {
    await firstValueFrom(service.domains$);
    backend.rows = [domain('first.com'), domain('added.com')];

    // A page that reloads in its subscribe callback must see the new rows
    const seen = await new Promise<DbDomain[]>((resolve) => {
      service.instance.saveDomain({} as never).subscribe(() => {
        firstValueFrom(service.domains$).then(resolve);
      });
    });

    expect(seen).toHaveLength(2);
  });
});
