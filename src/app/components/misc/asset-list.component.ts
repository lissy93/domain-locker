import { Component, NgZone, OnInit, inject } from '@angular/core';

import { PrimeNgModule } from '../../prime-ng.module';
import { DlIconComponent } from '~/app/components/misc/svg-icon.component';
import DatabaseService from '~/app/services/database.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

interface Asset {
  title: string;
  link: string;
  icon: string;
  viewBox?: string;
  count?: number;
  titleKey: string;
}

@Component({
  standalone: true,
  selector: 'app-asset-list',
  template: `
    <h2 class="my-4 block">{{ 'HOME.SUBHEADINGS.ASSETS' | translate }}</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
      @for (asset of assets; track asset) {
        <a
          pAnimateOnScroll
          enterClass="fadeIn"
          leaveClass="fadeOut"
          class="asset-card-link"
          [routerLink]="asset.link"
        >
          <div class="p-card asset-card">
            <h4>{{ asset.titleKey | translate }}</h4>
            @if (asset.count !== undefined) {
              <p class="text-surface-400 my-0">
                {{ asset.count }} {{ asset.titleKey | translate }}
              </p>
            }
            <div class="absolute top-2 right-4 h-16 w-16 opacity-70">
              <app-dl-icon
                [icon]="asset.icon"
                [viewBox]="asset.viewBox || '0 0 512 512'"
                classNames="w-full h-full"
                color="var(--surface-200)"
              />
            </div>
          </div>
        </a>
      }
    </div>
  `,
  styles: [
    `
      .asset-card-link {
        text-decoration: none;
        color: inherit;
        .asset-card {
          position: relative;
          break-inside: avoid !important;
          transition: ease-in-out 0.3s;
          border: 3px solid transparent;
          cursor: pointer;
          height: 100%;
          padding: 1rem;
          h4 {
            font-size: 1.4rem;
            margin: 0.5rem 0;
          }
          &:hover {
            border-color: var(--primary-color);
          }
        }
      }
    `,
  ],
  imports: [PrimeNgModule, DlIconComponent, TranslateModule],
})
export default class AssetListComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private ngZone = inject(NgZone);
  private errorHandlerService = inject(ErrorHandlerService);
  private translate = inject(TranslateService);

  assets: Asset[] = [
    {
      title: 'Registrars',
      link: '/assets/registrars',
      icon: 'registrar',
      viewBox: '0 0 620 512',
      titleKey: 'ASSETS.CARDS.REGISTRARS.PLURAL',
    },
    {
      title: 'IP Addresses',
      link: '/assets/ips',
      icon: 'ips',
      titleKey: 'ASSETS.CARDS.IP_ADDRESSES.PLURAL',
    },
    {
      title: 'SSL Certificates',
      link: '/assets/certs',
      icon: 'ssl',
      titleKey: 'ASSETS.CARDS.SSL_CERTIFICATES.PLURAL',
    },
    {
      title: 'Hosts',
      link: '/assets/hosts',
      icon: 'host',
      titleKey: 'ASSETS.CARDS.HOSTS.PLURAL',
    },
    {
      title: 'DNS Records',
      link: '/assets/dns',
      icon: 'dns',
      viewBox: '0 0 620 512',
      titleKey: 'ASSETS.CARDS.DNS_RECORDS.PLURAL',
    },
    {
      title: 'Subdomains',
      link: '/assets/subdomains',
      icon: 'subdomains',
      titleKey: 'ASSETS.CARDS.SUBDOMAINS.PLURAL',
    },
    {
      title: 'Links',
      link: '/assets/links',
      icon: 'links',
      titleKey: 'ASSETS.CARDS.LINKS.PLURAL',
    },
    {
      title: 'Tags',
      link: '/assets/tags',
      icon: 'tags',
      titleKey: 'ASSETS.CARDS.TAGS.PLURAL',
    },
    {
      title: 'Domain Statuses',
      link: '/assets/statuses',
      icon: 'status',
      titleKey: 'ASSETS.CARDS.STATUSES.PLURAL',
    },
  ];

  ngOnInit() {
    // Run the count fetching outside Angular's change detection
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => this.fetchAssetCounts(), 0);
    });
  }

  private fetchAssetCounts() {
    this.assets.forEach((asset) => {
      this.databaseService.instance.getAssetCount(asset.title.toLowerCase()).subscribe({
        next: (count) => {
          this.ngZone.run(() => {
            asset.count = count;
          });
        },
        error: (error) => {
          this.errorHandlerService.handleError({
            error,
            message: `Error fetching count for ${asset.title}`,
            location: 'AssetListComponent.fetchAssetCounts',
          });
        },
      });
    });
  }
}
