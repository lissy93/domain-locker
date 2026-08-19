import type { Kysely } from 'kysely';
import { currentBackend, getDb, type Backend } from '../client';
import type { Database } from '../schema';
import { adminRepo } from './admin';
import { assetsRepo } from './assets';
import { domainsRepo } from './domains';
import { exportRepo } from './export';
import { historyRepo } from './history';
import { linksRepo } from './links';
import { notificationsRepo } from './notifications';
import { subdomainsRepo } from './subdomains';
import { tagsRepo } from './tags';
import { uptimeRepo } from './uptime';

export function createRepos(db: Kysely<Database>, backend: Backend) {
  return {
    admin: adminRepo(db),
    assets: assetsRepo(db),
    domains: domainsRepo(db),
    export: exportRepo(db),
    history: historyRepo(db),
    links: linksRepo(db),
    notifications: notificationsRepo(db),
    subdomains: subdomainsRepo(db),
    tags: tagsRepo(db),
    uptime: uptimeRepo(db, backend),
  };
}

export type Repos = ReturnType<typeof createRepos>;

let shared: Repos | null = null;

/** Repositories bound to the shared connection, for use inside request handlers */
export function repos(): Repos {
  shared ??= createRepos(getDb(), currentBackend());
  return shared;
}

export function resetRepos(): void {
  shared = null;
}
