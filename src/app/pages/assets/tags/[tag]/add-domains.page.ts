import { Component, OnInit, inject } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DbDomain, Tag } from '~/app/../types/Database';
import { TagPickListComponent } from '~/app/components/forms/tag-picklist/tag-picklist.component';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-assets-tags-tag-add-domains-page',
  imports: [PrimeNgModule, TagPickListComponent],
  template: ` <h2 class="mb-4 ml-4">Add Domains: {{ tagName }}</h2>
    @if (tag && tag.id) {
      <div class="p-card p-4 m-4">
        <app-domain-tag-picklist [tagId]="tag.id" ($afterSave)="afterSave()" />
      </div>
    }`,
})
export default class TagDomainsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);

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
    if (this.tagName) {
      this.router.navigate([`/assets/tags/${this.tagName}`]);
    } else {
      this.router.navigate([`/assets/tags`]);
    }
  }
}
