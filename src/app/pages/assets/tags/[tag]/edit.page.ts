import { Component, OnInit, inject } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DbDomain, Tag } from '~/app/../types/Database';
import { TagEditorComponent } from '~/app/components/forms/tag-editor/tag-editor.component';
import DatabaseService from '~/app/services/database.service';
import { MessageService } from 'primeng/api';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-assets-tags-tag-edit-page',
  imports: [PrimeNgModule, TagEditorComponent],
  template: ` <h2 class="mb-4 ml-4">Edit Tag: {{ tagName }}</h2>
    <div class="p-card p-4 m-4">
      <app-tag-editor [tag]="tag" ($afterSave)="afterSave()" />
    </div>`,
})
export default class TagDomainsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);

  tagName = '';
  domains: DbDomain[] = [];
  loading = true;
  dialogOpen = false;
  tag: Partial<Tag> = {};

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.tagName = params['tag'];
      this.loadTag();
    });
  }

  loadTag() {
    this.loading = true;
    this.databaseService.instance.tagQueries.getTag(this.tagName).subscribe({
      next: (tag) => {
        this.tag = tag;
        if (tag.icon && !tag.icon.includes('/')) {
          this.tag.icon = `mdi/${tag.icon}`;
        }
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to load tag details',
          error,
          showToast: true,
          location: 'TagDomainsPageComponent.loadTag',
        });
        this.loading = false;
      },
    });
  }

  afterSave() {
    this.router.navigate([`/assets/tags/${this.tag.name}/add-domains`]);
  }
}
