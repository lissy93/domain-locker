import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { MessageService } from 'primeng/api';
import DatabaseService from '~/app/services/database.service';
import { Tag } from '~/app/../types/common';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  selector: 'app-tag-editor',
  templateUrl: './tag-editor.component.html',
  styleUrls: ['./tag-editor.component.scss'],
  standalone: true,
  imports: [PrimeNgModule],
})
export class TagEditorComponent {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  @Input() tag: Partial<Tag> = {};
  @Input() isAddNew = false;
  @Input() afterSave: (p?: string) => void = () => {
    /* no-op */
  };
  @Output() $afterSave = new EventEmitter<string>();

  tagColors: string[] = [
    'blue',
    'green',
    'yellow',
    'cyan',
    'pink',
    'indigo',
    'teal',
    'orange',
    'purple',
    'red',
    'gray',
  ];

  saveTag() {
    if (!this.tag.name?.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Tag name is required',
      });
      return;
    }

    if (this.isAddNew) {
      this.createTag();
    } else {
      this.updateTag();
    }
  }

  private createTag() {
    this.databaseService.instance.tagQueries.createTag(this.tag as Tag).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Tag created successfully',
        });
        this.$afterSave.emit(this.tag.name);
      },
      error: (err) => {
        if (err.code === '23505') {
          // Handle duplicate tag names
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Tag with this name already exists',
          });
        } else {
          this.errorHandler.handleError({
            error: err,
            message: 'Failed to create tag',
            location: 'TagEditorComponent.createTag',
            showToast: true,
          });
        }
      },
    });
  }

  private updateTag() {
    this.databaseService.instance.tagQueries.updateTag(this.tag as Tag).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Tag updated successfully',
        });
        this.$afterSave.emit(this.tag.name);
      },
      error: (err) => {
        this.errorHandler.handleError({
          error: err,
          message: 'Failed to update tag',
          location: 'TagEditorComponent.updateTag',
          showToast: true,
        });
      },
    });
  }

  isValidIcon(): boolean {
    if (!this.tag.icon) return false;
    const iconRegex = /^[a-z]+\/[a-z-]+$/;
    return iconRegex.test(this.tag.icon);
  }
}
