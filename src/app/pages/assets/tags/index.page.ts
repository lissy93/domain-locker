import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { Tag } from '~/app/../types/Database';
import DatabaseService from '~/app/services/database.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TagEditorComponent } from '~/app/components/forms/tag-editor/tag-editor.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { TableModule } from 'primeng/table';

@Component({
  standalone: true,
  selector: 'app-assets-tags-page',
  imports: [RouterModule, PrimeNgModule, TagEditorComponent, TableModule],
  templateUrl: './index.page.html',
  styleUrl: './tags.scss',
})
export default class TagsIndexPageComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private errorHandler = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);

  tags: (Tag & { domainCount: number })[] = [];
  loading = true;
  addTagDialogOpen = false;

  ngOnInit() {
    this.loadTags();
  }

  loadTags() {
    this.loading = true;
    this.databaseService.instance.tagQueries.getTags().subscribe({
      next: (tags) => {
        this.tags = tags.map((tag) => ({ ...tag, domainCount: 0 }));
        this.loadDomainCounts();
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to load tags',
          error,
          showToast: true,
          location: 'TagsIndexPageComponent.loadTags',
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadDomainCounts() {
    this.databaseService.instance.tagQueries.getDomainCountsByTag().subscribe({
      next: (counts) => {
        this.tags = this.tags.map((tag) => ({
          ...tag,
          domainCount: counts[tag.name] || 0,
        }));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to load domain counts',
          error,
          showToast: true,
          location: 'TagsIndexPageComponent.loadDomainCounts',
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  showAddTagDialog() {
    this.addTagDialogOpen = true;
  }

  afterAddNewTag() {
    this.addTagDialogOpen = false;
    this.loadTags();
  }

  deleteTag(tag: Tag) {
    this.confirmationService.confirm({
      message: `
        Are you sure you want to delete the "${tag.name}" tag?<br>
        <b class="text-red-500">This action cannot be undone.</b><br>
        <p class="text-surface-400 text-sm">Note that this will not affect the domains associated with this tag,<br>
        but they will loose their association.</p>
      `,
      header: `Tag Deletion Confirmation: ${tag.name}`,
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-secondary p-button-sm',
      accept: () => {
        this.databaseService.instance.tagQueries.deleteTag(tag.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: `Tag "${tag.name}" deleted successfully.`,
            });
            this.loadTags();
          },
          error: (error) => {
            this.errorHandler.handleError({
              message: 'Failed to delete tag',
              error,
              showToast: true,
              location: 'TagsIndexPageComponent.deleteTag',
            });
          },
        });
      },
    });
  }
}
