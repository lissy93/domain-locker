import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { distinctUntilChanged } from 'rxjs/operators';
import { EnvService } from '~/app/services/environment.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import DatabaseService from '~/app/services/database.service';
import { FeatureService } from '~/app/services/features.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';

@Component({
  standalone: true,
  selector: 'app-advanced-database-connection-page',
  imports: [CommonModule, PrimeNgModule, ReactiveFormsModule, FeatureNotEnabledComponent],
  templateUrl: './database-connection.page.html',
  styles: [``],
})
export default class DatabaseConnectionPage implements OnInit {
  private fb = inject(FormBuilder);
  private envService = inject(EnvService);
  private errorHandler = inject(ErrorHandlerService);
  private featureService = inject(FeatureService);
  private messagingService = inject(GlobalMessageService);
  private databaseService = inject(DatabaseService);

  dbForm!: FormGroup;
  initialServiceType = 'none';
  dbConfigEnabled$ = this.featureService.isFeatureEnabled('allowLocalDbConfig');

  DB_TYPES = [
    { label: 'Postgres', value: 'postgres' },
    { label: 'Supabase', value: 'supabase' },
  ];

  ngOnInit(): void {
    this.initForm();
    this.initialServiceType = this.databaseService.serviceType;
  }

  private initForm() {
    // By default => 'postgres' unless SUPABASE_URL is found
    const hasSupabase = !!localStorage.getItem('SUPABASE_URL');
    const defaultType = hasSupabase ? 'supabase' : 'postgres';

    this.dbForm = this.fb.group({
      dbType: [defaultType, Validators.required],

      // Supabase
      supabaseUrl: [localStorage.getItem('SUPABASE_URL') || ''],
      supabaseAnon: [localStorage.getItem('SUPABASE_ANON_KEY') || ''],

      // Postgres
      pgHost: [localStorage.getItem('DL_PG_HOST') || ''],
      pgPort: [localStorage.getItem('DL_PG_PORT') || ''],
      pgUser: [localStorage.getItem('DL_PG_USER') || ''],
      pgPassword: [localStorage.getItem('DL_PG_PASSWORD') || ''],
      pgDatabase: [localStorage.getItem('DL_PG_NAME') || ''],
    });

    // Initial call to set correct validators
    this.setValidatorsBasedOnType(defaultType);

    // Listen for changes only if type actually changes
    this.dbForm
      .get('dbType')
      ?.valueChanges.pipe(distinctUntilChanged())
      .subscribe((type) => {
        this.setValidatorsBasedOnType(type);
      });
  }

  private setValidatorsBasedOnType(type: string) {
    // Clear old validators
    this.dbForm.get('supabaseUrl')?.clearValidators();
    this.dbForm.get('supabaseAnon')?.clearValidators();
    this.dbForm.get('pgHost')?.clearValidators();
    this.dbForm.get('pgPort')?.clearValidators();
    this.dbForm.get('pgUser')?.clearValidators();
    this.dbForm.get('pgPassword')?.clearValidators();
    this.dbForm.get('pgDatabase')?.clearValidators();

    if (type === 'supabase') {
      // supabase fields are required
      this.dbForm.get('supabaseUrl')?.setValidators([Validators.required]);
      this.dbForm.get('supabaseAnon')?.setValidators([Validators.required]);
    } else {
      // postgres fields are required
      this.dbForm.get('pgHost')?.setValidators([Validators.required]);
      this.dbForm.get('pgPort')?.setValidators([Validators.required]);
      this.dbForm.get('pgUser')?.setValidators([Validators.required]);
      this.dbForm.get('pgPassword')?.setValidators([Validators.required]);
      this.dbForm.get('pgDatabase')?.setValidators([Validators.required]);
    }

    // Update each control's validity without re-emitting valueChanges
    this.dbForm.get('supabaseUrl')?.updateValueAndValidity({ emitEvent: false });
    this.dbForm.get('supabaseAnon')?.updateValueAndValidity({ emitEvent: false });
    this.dbForm.get('pgHost')?.updateValueAndValidity({ emitEvent: false });
    this.dbForm.get('pgPort')?.updateValueAndValidity({ emitEvent: false });
    this.dbForm.get('pgUser')?.updateValueAndValidity({ emitEvent: false });
    this.dbForm.get('pgPassword')?.updateValueAndValidity({ emitEvent: false });
    this.dbForm.get('pgDatabase')?.updateValueAndValidity({ emitEvent: false });
  }

  async onSave() {
    if (!(await this.featureService.isFeatureEnabledPromise('allowLocalDbConfig'))) {
      this.messagingService.showWarn(
        'Operation Cancelled',
        'Connection to external databases is disallowed on this instance.',
      );
      return;
    }
    if (this.dbForm.invalid) {
      this.messagingService.showError(
        'Invalid Inputs',
        'Please fill out all required fields.',
      );
      return;
    }

    const type = this.dbForm.value.dbType;

    if (type === 'supabase') {
      localStorage.setItem('SUPABASE_URL', this.dbForm.value.supabaseUrl);
      localStorage.setItem('SUPABASE_ANON_KEY', this.dbForm.value.supabaseAnon);

      localStorage.removeItem('DL_PG_HOST');
      localStorage.removeItem('DL_PG_PORT');
      localStorage.removeItem('DL_PG_USER');
      localStorage.removeItem('DL_PG_PASSWORD');
      localStorage.removeItem('DL_PG_NAME');

      this.messagingService.showSuccess(
        'Supabase Config Saved',
        'Your Supabase credentials have been updated.',
      );
    } else {
      localStorage.setItem('DL_PG_HOST', this.dbForm.value.pgHost);
      localStorage.setItem('DL_PG_PORT', this.dbForm.value.pgPort);
      localStorage.setItem('DL_PG_USER', this.dbForm.value.pgUser);
      localStorage.setItem('DL_PG_PASSWORD', this.dbForm.value.pgPassword);
      localStorage.setItem('DL_PG_NAME', this.dbForm.value.pgDatabase);

      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');

      this.messagingService.showSuccess(
        'Postgres Config Saved',
        'Your Postgres credentials have been updated.',
      );
    }
  }

  onResetSupabase() {
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_ANON_KEY');
    this.dbForm.patchValue({
      supabaseUrl: '',
      supabaseAnon: '',
    });
    this.messagingService.showInfo(
      'Supabase Reset',
      'Supabase keys have been removed from local storage.',
    );
  }

  onResetPostgres() {
    localStorage.removeItem('DL_PG_HOST');
    localStorage.removeItem('DL_PG_PORT');
    localStorage.removeItem('DL_PG_USER');
    localStorage.removeItem('DL_PG_PASSWORD');
    localStorage.removeItem('DL_PG_NAME');
    this.dbForm.patchValue({
      pgHost: '',
      pgPort: '5432',
      pgUser: '',
      pgPassword: '',
      pgDatabase: '',
    });
    this.messagingService.showInfo(
      'Postgres Reset',
      'Postgres keys have been removed from local storage.',
    );
  }

  onTestConnection() {
    this.messagingService.showInfo('Test Connection', 'Not implemented yet.');
  }
}
