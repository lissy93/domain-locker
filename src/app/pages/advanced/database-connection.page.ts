import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { EnvService } from '~/app/services/environment.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { ApiClient } from '~/app/services/db-query-services/api/api-client';
import DatabaseService from '~/app/services/database.service';
import type { DatabaseInfo } from '~/types/common';

interface LegacyCredential {
  key: string;
  label: string;
}

interface InfoRow {
  label: string;
  value: string;
}

/** Byte counts, at the largest unit that keeps them readable */
function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

const LEGACY_KEYS: LegacyCredential[] = [
  { key: 'DL_PG_HOST', label: 'Host' },
  { key: 'DL_PG_PORT', label: 'Port' },
  { key: 'DL_PG_USER', label: 'User' },
  { key: 'DL_PG_PASSWORD', label: 'Password' },
  { key: 'DL_PG_NAME', label: 'Database' },
  { key: 'SUPABASE_URL', label: 'Supabase URL' },
  { key: 'SUPABASE_ANON_KEY', label: 'Supabase key' },
];

@Component({
  standalone: true,
  selector: 'app-advanced-database-connection-page',
  imports: [CommonModule, PrimeNgModule],
  templateUrl: './database-connection.page.html',
  styles: [``],
})
export default class DatabaseConnectionPage implements OnInit {
  private envService = inject(EnvService);
  private messagingService = inject(GlobalMessageService);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private api = inject(ApiClient);

  serviceType = 'none';
  backend: string | null = null;
  leftoverCredentials: LegacyCredential[] = [];
  infoRows: InfoRow[] = [];

  ngOnInit(): void {
    this.serviceType = this.databaseService.serviceType;
    this.backend = this.envService.getDatabaseBackend();
    this.leftoverCredentials = LEGACY_KEYS.filter((entry) =>
      Boolean(this.envService.getValueFromLocalStorage(entry.key)),
    );
    // 'postgres' is the self-hosted API service, whichever engine it holds
    if (this.serviceType === 'postgres') this.loadDatabaseInfo();
  }

  private loadDatabaseInfo(): void {
    this.api.get<DatabaseInfo>('/v1/admin/database').subscribe({
      next: (info) => (this.infoRows = this.toRows(info)),
      error: (error) =>
        this.errorHandler.handleError({
          error,
          message: 'Failed to load database details',
          location: 'database-connection',
          showToast: false,
        }),
    });
  }

  private toRows(info: DatabaseInfo): InfoRow[] {
    const schema = { label: 'Schema version', value: info.schemaVersion ?? 'Unknown' };

    if (info.backend === 'postgres') {
      return [
        { label: 'Server version', value: info.version },
        { label: 'Database', value: info.database },
        { label: 'Size', value: formatBytes(info.sizeBytes) },
        schema,
      ];
    }

    return [
      { label: 'SQLite version', value: info.version },
      { label: 'File', value: info.path },
      { label: 'Size', value: formatBytes(info.sizeBytes) },
      { label: 'Write-ahead log', value: formatBytes(info.walBytes) },
      { label: 'Reclaimable', value: formatBytes(info.reclaimableBytes) },
      { label: 'Journal mode', value: info.journalMode.toUpperCase() },
      { label: 'Foreign keys', value: info.foreignKeys ? 'On' : 'Off' },
      { label: 'Busy timeout', value: `${info.busyTimeoutMs}ms` },
      {
        label: 'Last write',
        value: info.lastModified
          ? new Date(info.lastModified).toLocaleString()
          : 'Unknown',
      },
      schema,
    ];
  }

  /** Clears credentials older versions stored in the browser */
  clearLegacyCredentials(): void {
    for (const entry of LEGACY_KEYS) {
      localStorage.removeItem(entry.key);
    }
    this.leftoverCredentials = [];
    this.messagingService.showSuccess(
      'Credentials cleared',
      'Stored database credentials have been removed from this browser.',
    );
  }
}
