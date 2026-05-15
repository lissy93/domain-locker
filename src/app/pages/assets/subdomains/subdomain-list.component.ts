import { Component, Input, OnChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import DatabaseService from '~/app/services/database.service';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { ConfirmationService } from 'primeng/api';
import { makeKVList } from './subdomain-utils';
import { MenuItem } from 'primeng/api';
import { ContextMenu } from 'primeng/contextmenu';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { FeatureService } from '~/app/services/features.service';

export interface SubdomainView {
  id?: string;
  name: string;
  sd_info?: string | null | unknown;
  domain_name?: string;
}

type SubdomainRow = SubdomainView & { kvList: { key: string; value: string }[] };

@Component({
  standalone: true,
  selector: 'app-subdomain-list',
  imports: [CommonModule, RouterModule, PrimeNgModule, DomainFaviconComponent],
  template: `
    <ul
      [class]="
        ' list-none p-0 m-0 grid grid-cols-1 ' +
        (embeddedView
          ? 'xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-3 '
          : ' md:grid-cols-2 lg:grid-cols-3 gap-4 ')
      "
    >
      @for (subdomain of subdomainsToShow; track subdomain) {
        <li
          [ngClass]="{
            'px-4 py-3 rounded shadow relative': true,
            'border-2 border-surface-100': embeddedView,
            'p-card': !embeddedView,
          }"
          (contextmenu)="onRightClick($event, subdomain)"
        >
          <a
            [routerLink]="['/assets/subdomains', domain, subdomain.name]"
            class="text-primary no-underline hover:underline"
          >
            <h3 class="text-lg font-bold text-default truncate">
              <app-domain-favicon
                [domain]="subdomain.name + '.' + domain"
                [size]="24"
                class="mr-2"
              />
              <span class="text-primary">{{ subdomain.name }}</span>
              <span>.</span>
              <span>{{ domain }}</span>
            </h3>
          </a>
          @for (item of subdomain.kvList; track item.key) {
            <ul class="m-0 p-0 list-none text-sm text-surface-500 opacity-90">
              <li class="truncate">
                <strong class="font-semibold">{{ item.key }}</strong
                >: {{ item.value }}
              </li>
            </ul>
          }
        </li>
      }
    </ul>

    @if (embeddedView) {
      <p-divider align="center" (click)="toggleShowAll()">
        @if (!showFullList) {
          <div
            class="flex gap-2 items-center px-3 py-2 cursor-pointer hover:text-primary bg-highlight rounded"
          >
            <i class="pi pi-angle-double-down"></i>
            <span>Expand List</span>
            <i class="pi pi-angle-double-down"></i>
          </div>
        } @else {
          <div
            class="flex gap-2 items-center px-1 py-1 cursor-pointer hover:text-primary text-xs opacity-70 bg-highlight rounded-sm"
          >
            <i class="pi pi-angle-double-up"></i>
            <span>Show Less</span>
            <i class="pi pi-angle-double-up"></i>
          </div>
        }
      </p-divider>
    }
    <p-confirmDialog />
    <p-contextMenu #contextMenu [model]="menuItems"></p-contextMenu>
  `,
  providers: [ConfirmationService],
})
export class SubdomainListComponent implements OnChanges {
  private confirmationService = inject(ConfirmationService);
  private messagingService = inject(GlobalMessageService);
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private featureService = inject(FeatureService);
  private router = inject(Router);

  @Input() domain = '';
  @Input() subdomains: SubdomainView[] = [];
  @Input() embeddedView = false;
  @ViewChild('contextMenu') menu: ContextMenu | undefined;
  subdomainsToShow: SubdomainRow[] = [];
  showFullList = false;

  menuItems: MenuItem[] = [];
  selectedSubdomain: SubdomainView | null = null;

  ngOnChanges(): void {
    const rows = this.subdomains.map((s) => ({ ...s, kvList: makeKVList(s.sd_info) }));
    this.subdomainsToShow =
      this.embeddedView && !this.showFullList ? rows.slice(0, 8) : rows;
  }

  onRightClick(event: MouseEvent, subdomain: SubdomainView) {
    this.selectedSubdomain = subdomain;
    this.menuItems = this.createMenuItems();
    if (this.menu) this.menu.show(event);
    event.preventDefault();
  }

  toggleShowAll() {
    this.showFullList = !this.showFullList;
    const rows = this.subdomains.map((s) => ({ ...s, kvList: makeKVList(s.sd_info) }));
    this.subdomainsToShow = this.showFullList ? rows : rows.slice(0, 8);
  }

  createMenuItems(): MenuItem[] {
    if (!this.selectedSubdomain) return [];

    const subdomainUrl = `${this.selectedSubdomain.name}.${this.domain}`;
    return [
      {
        label: 'View Subdomain',
        icon: 'pi pi-search',
        command: () =>
          this.navigateTo(
            `/assets/subdomains/${this.domain}/${this.selectedSubdomain!.name}`,
          ),
      },
      {
        label: 'Visit Subdomain',
        icon: 'pi pi-external-link',
        command: () => window.open(`https://${subdomainUrl}`, '_blank'),
      },
      {
        label: 'Edit Subdomain',
        icon: 'pi pi-pencil',
        command: () => this.editSubdomain(this.selectedSubdomain!),
      },
      {
        label: 'Delete Subdomain',
        icon: 'pi pi-trash',
        command: () => this.deleteSubdomain(this.selectedSubdomain!),
      },
      {
        separator: true,
      },
      {
        label: 'View Parent',
        icon: 'pi pi-folder',
        command: () => this.navigateTo(`/domains/${this.domain}`),
      },
      {
        label: 'Edit Parent',
        icon: 'pi pi-cog',
        command: () => this.navigateTo(`/domains/${this.domain}/edit`),
      },
    ];
  }

  private navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  private editSubdomain(_subdomain: SubdomainView): void {
    // TODO: Implement edit subdomain, and open dialog
  }

  async deleteSubdomain(subdomain: SubdomainView): Promise<void> {
    if (!(await this.featureService.isFeatureEnabledPromise('writePermissions'))) {
      this.messagingService.showWarn(
        'Write Permissions Disabled',
        "It's not possible to delete subdomains on the demo instance.",
      );
      return;
    }
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the subdomain "${subdomain.name}.${this.domain}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.databaseService.instance.subdomainsQueries
          .deleteSubdomain(this.domain, subdomain.name)
          .subscribe({
            next: () => {
              this.messagingService.showSuccess(
                'Deleted',
                `Subdomain "${subdomain.name}.${this.domain}" has been deleted successfully.`,
              );
              this.router.navigate(['/assets/subdomains', this.domain]);
            },
            error: (error: Error) => {
              this.errorHandler.handleError({
                error,
                showToast: true,
                message: 'Failed to delete the subdomain. Please try again.',
              });
            },
          });
      },
      reject: () => {
        this.messagingService.showInfo('Cancelled', 'Deletion cancelled');
      },
    });
  }
}
