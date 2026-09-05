import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { EnvService } from '~/app/services/environment.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import DatabaseService from '~/app/services/database.service';

interface LegacyCredential {
  key: string;
  label: string;
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

  serviceType = 'none';
  backend: string | null = null;
  leftoverCredentials: LegacyCredential[] = [];

  ngOnInit(): void {
    this.serviceType = this.databaseService.serviceType;
    this.backend = this.envService.getDatabaseBackend();
    this.leftoverCredentials = LEGACY_KEYS.filter((entry) =>
      Boolean(this.envService.getValueFromLocalStorage(entry.key)),
    );
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
