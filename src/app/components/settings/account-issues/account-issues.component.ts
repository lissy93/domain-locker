import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { SupabaseService } from '~/app/services/supabase.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

interface AccountIssueInterface {
  type: 'warn' | 'error' | 'info' | 'success';
  message: string;
  action?: { label: string; route?: string; callback?: () => void };
}

@Component({
  selector: 'app-account-issues',
  standalone: true,
  imports: [PrimeNgModule],
  templateUrl: './account-issues.component.html',
})
export class AccountIssuesComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private errorHandler = inject(ErrorHandlerService);

  accountIssues: AccountIssueInterface[] = [
    { type: 'success', message: 'No issues found' },
  ];
  loading = true;

  async ngOnInit(): Promise<void> {
    try {
      const accountIssues = await this.supabaseService.getAccountIssues();
      if (accountIssues.length) this.accountIssues = accountIssues;
    } catch (error) {
      this.errorHandler.handleError({
        message: 'Failed to load account issues',
        error,
        showToast: true,
        location: 'AccountIssuesComponent.ngOnInit',
      });
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
