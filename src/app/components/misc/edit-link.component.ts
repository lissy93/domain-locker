import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { Observable } from 'rxjs';
import { ModifiedLink } from '~/app/pages/assets/links/index.page';

@Component({
  standalone: true,
  selector: 'app-link-dialog',
  imports: [CommonModule, ReactiveFormsModule, PrimeNgModule],
  templateUrl: './edit-link.component.html',
})
export class LinkDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private databaseService = inject(DatabaseService);
  config = inject(DynamicDialogConfig);
  ref = inject(DynamicDialogRef);

  linkForm: FormGroup;
  domainOptions$: Observable<string[]> | undefined;
  visible = true;

  isEdit: boolean;
  link: ModifiedLink | null;

  constructor() {
    const { link, isEdit } = this.config.data || {};
    this.link = link || null;
    this.isEdit = !!isEdit;

    // Initialize the form
    this.linkForm = this.fb.group({
      link_name: [this.link?.link_name || '', Validators.required],
      link_url: [
        this.link?.link_url || '',
        [Validators.required, Validators.pattern(/^https?:\/\/.+$/)],
      ],
      link_description: [this.link?.link_description || ''],
      domains: [this.link?.domains || []],
    });
  }

  ngOnInit(): void {
    this.domainOptions$ = this.databaseService.instance.listDomainNames();
  }

  onSave(): void {
    if (this.linkForm.invalid) return;
    this.ref.close(this.linkForm.value); // Return data to parent
  }

  onCancel(): void {
    this.ref.close(null); // Dismiss dialog without saving
  }
}
