import { Component, Input, OnInit, ViewChild, inject } from '@angular/core';

import DatabaseService from '~/app/services/database.service';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ContextMenu } from 'primeng/contextmenu';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

interface TagWithCount {
  id?: string;
  tag_id?: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  domain_count: number;
}

@Component({
  standalone: true,
  selector: 'app-tag-grid',
  templateUrl: './tag-grid.component.html',
  styleUrls: ['../../pages/assets/tags/tags.scss'],
  imports: [PrimeNgModule, TranslateModule],
})
export class TagGridComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private confirmationService = inject(ConfirmationService);
  private errorHandler = inject(ErrorHandlerService);
  private translate = inject(TranslateService);

  public tags: TagWithCount[] = [];
  public loading = true;
  public contextMenuItems: MenuItem[] = [];
  private selectedTag: TagWithCount | undefined;
  @Input() public miniGrid = false;
  @ViewChild('menu') menu: ContextMenu | undefined;

  ngOnInit() {
    this.loadTagsWithCounts();
    this.initializeContextMenu();
  }

  loadTagsWithCounts() {
    this.loading = true;
    this.databaseService.instance.tagQueries.getTagsWithDomainCounts().subscribe({
      next: (tagsWithCounts) => {
        this.tags = tagsWithCounts;
        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          error,
          message: this.translate.instant('ASSETS.TAG_GRID.ERROR'),
          showToast: true,
        });
        this.loading = false;
      },
    });
  }

  initializeContextMenu() {
    this.contextMenuItems = [
      {
        label: this.translate.instant('ASSETS.TAG_GRID.CONTEXT_MENU.VIEW_TAG'),
        icon: 'pi pi-eye',
        command: () => this.viewTag(),
      },
      {
        label: this.translate.instant('ASSETS.TAG_GRID.CONTEXT_MENU.EDIT'),
        icon: 'pi pi-pencil',
        command: () => this.editTag(),
      },
      {
        label: this.translate.instant('ASSETS.TAG_GRID.CONTEXT_MENU.MOVE_DOMAINS'),
        icon: 'pi pi-check-square',
        command: () => this.addRemoveDomains(),
      },
      {
        label: this.translate.instant('ASSETS.TAG_GRID.CONTEXT_MENU.DELETE_TAG'),
        icon: 'pi pi-trash',
        command: () => this.deleteTag(),
      },
      {
        label: this.translate.instant('ASSETS.TAG_GRID.CONTEXT_MENU.ADD_NEW_TAG'),
        icon: 'pi pi-plus',
        command: () => this.addNewTag(),
      },
    ];
  }

  onRightClick(event: MouseEvent, tag: TagWithCount) {
    this.selectedTag = tag;
    if (this.menu) {
      this.menu.show(event);
    }
    event.preventDefault();
  }

  viewTag() {
    if (!this.selectedTag) return;
    this.router.navigate(['/assets/tags', this.selectedTag.name]);
  }

  editTag() {
    if (!this.selectedTag) return;
    this.router.navigate(['/assets/tags', this.selectedTag.name, 'edit']);
  }

  addRemoveDomains() {
    if (!this.selectedTag) return;
    this.router.navigate(['/assets/tags', this.selectedTag.name, 'add-domains']);
  }

  addNewTag() {
    this.router.navigate(['/assets/tags/new']);
  }

  deleteTag() {
    if (!this.selectedTag) return;
    const selectedTag = this.selectedTag;
    this.confirmationService.confirm({
      message: this.translate.instant('ASSETS.TAG_GRID.DELETE_CONFIRM_MESSAGE', {
        tag: selectedTag.name,
      }),
      header: this.translate.instant('ASSETS.TAG_GRID.DELETE_CONFIRM_HEADER', {
        tag: selectedTag.name,
      }),
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-secondary p-button-sm',
      accept: () => {
        if (!selectedTag.tag_id) return;
        this.databaseService.instance.tagQueries.deleteTag(selectedTag.tag_id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('ASSETS.TAG_GRID.DELETE_SUCCESS_SUMMARY'),
              detail: this.translate.instant('ASSETS.TAG_GRID.DELETE_SUCCESS_DETAIL', {
                tag: selectedTag.name,
              }),
            });
            this.loadTagsWithCounts();
          },
          error: (error) => {
            this.errorHandler.handleError({
              error,
              message: this.translate.instant('ASSETS.TAG_GRID.ERROR'),
              showToast: true,
            });
          },
        });
      },
    });
  }
}
