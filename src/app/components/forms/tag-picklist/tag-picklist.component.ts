import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { MessageService } from 'primeng/api';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  selector: 'app-domain-tag-picklist',
  templateUrl: './tag-picklist.component.html',
  standalone: true,
  imports: [PrimeNgModule],
  styles: [
    `
      ::ng-deep .p-picklist-target-controls,
      ::ng-deep .p-picklist-source-controls {
        display: none;
      }
    `,
  ],
})
export class TagPickListComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  @Input() tagId: string | undefined;
  @Output() $afterSave = new EventEmitter();

  availableDomains: Record<string, unknown>[] = [];
  selectedDomains: { id?: string }[] = [];

  ngOnInit(): void {
    if (this.tagId) {
      this.loadDomainsForTag(this.tagId);
    }
  }

  // Load domains already associated with the tag and all available domains
  private loadDomainsForTag(tagId: string) {
    this.databaseService.instance.tagQueries.getDomainsForTag(tagId).subscribe({
      next: ({ available, selected }) => {
        const selectedTyped = selected as { id?: string }[];
        const selectedDomainIds = selectedTyped.map((domain) => domain.id);
        this.availableDomains = available.filter(
          (domain) => !selectedDomainIds.includes(domain['id'] as string),
        );
        this.selectedDomains = selectedTyped;
      },
      error: (error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to load domains for this tag',
          location: 'TagPickListComponent.loadDomainsForTag',
          showToast: true,
        });
      },
    });
  }

  // Save the tag for the selected domains
  saveDomainsForTag() {
    if (!this.tagId) {
      this.errorHandler.handleError({
        message: 'Tag ID is missing',
        location: 'TagPickListComponent.saveDomainsForTag',
        showToast: true,
      });
      return;
    }
    this.databaseService.instance.tagQueries
      .saveDomainsForTag(this.tagId, this.selectedDomains as { id: string }[])
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Domains saved successfully',
          });
          this.$afterSave.emit();
        },
        error: (error) => {
          this.errorHandler.handleError({
            error,
            message: 'Failed to save domains for this tag',
            location: 'TagPickListComponent.saveDomainsForTag',
            showToast: true,
          });
        },
      });
  }
}
