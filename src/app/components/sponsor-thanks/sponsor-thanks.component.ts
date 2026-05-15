import { Component, OnInit, inject } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { SupabaseService } from '~/app/services/supabase.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-sponsor-message',
  imports: [PrimeNgModule],
  templateUrl: './sponsor-thanks.component.html',
  styles: [``],
})
export class SponsorMessageComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private http = inject(HttpClient);
  private errorHandler = inject(ErrorHandlerService);
  private messageService = inject(GlobalMessageService);
  private router = inject(Router);

  githubUsername: string | null = null;
  isSponsor = false;
  isHidden = false;
  inSelfHostingDocs = false;

  async ngOnInit(): Promise<void> {
    try {
      // Check localStorage for hide preference (browser-only)
      if (this.isBrowser() && localStorage.getItem('hideSponsorThanks') === 'true') {
        this.isHidden = true;
        return;
      }

      if (this.router.url.includes('self-hosting')) {
        this.inSelfHostingDocs = true;
      }

      // Get session data
      const sessionData = await this.supabase.getSessionData();

      interface Identity {
        provider: string;
        identity_data?: Record<string, string>;
      }
      const identities: Identity[] =
        (sessionData as { session?: { user?: { identities?: Identity[] } } })?.session
          ?.user?.identities || [];
      const githubIdentity = identities.find(
        (identity) => identity.provider === 'github',
      );

      this.githubUsername = githubIdentity?.identity_data?.['user_name'] || null;

      if (this.githubUsername) {
        // Check if user is a sponsor
        this.http
          .get<{ login: string }[]>(`https://github-sponsors-api.as93.net/lissy93`)
          .subscribe({
            next: (sponsors) => {
              this.isSponsor = sponsors.some(
                (sponsor) => sponsor.login === this.githubUsername,
              );
            },
            error: (error) => this.errorHandler.handleError({ error }),
          });
      }
    } catch (error) {
      this.errorHandler.handleError({ error });
    }
  }

  hideSponsorThanks(): void {
    if (this.isBrowser()) {
      localStorage.setItem('hideSponsorThanks', 'true');
      this.messageService.showInfo(
        'Sponsor Section Deactivated',
        "No problem! We won't mention this again!",
      );
    }
    this.isHidden = true;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}
