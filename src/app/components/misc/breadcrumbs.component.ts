import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { MenuItem } from 'primeng/api';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { DlIconComponent } from '~/app/components/misc/svg-icon.component';
import { MetaTagsService } from '~/app/services/meta-tags.service';
import {
  statsLinks,
  settingsLinks,
  aboutLinks,
  authenticatedNavLinks,
  unauthenticatedNavLinks,
  ExtendedMenuItem,
  toolsLinks,
} from '~/app/constants/navigation-links';

@Component({
  standalone: true,
  selector: 'app-breadcrumbs',
  imports: [CommonModule, PrimeNgModule, DomainFaviconComponent, DlIconComponent],
  template: `
    @if (shouldShowBreadcrumbs) {
      <p-breadcrumb styleClass="ml-2 mb-2" [model]="breadcrumbs">
        <ng-template pTemplate="item" let-item>
          @if (item.route) {
            <a [routerLink]="item.route" class="p-menuitem-link">
              @if (item.icon) {
                <span [ngClass]="['mr-2 text-primary', item.icon]"></span>
              }
              @if (isDomainPage(item.label)) {
                <app-domain-favicon [domain]="item.label" [size]="20" class="mr-1" />
              }
              @if (item.svgIcon) {
                <app-dl-icon
                  [icon]="item.svgIcon"
                  class="w-[1.25rem] h-5 mr-1"
                  classNames="w-full h-full text-primary"
                  color="var(--primary-color)"
                />
              }
              <app-dl-icon icon="webHook" classNames="w-full h-full text-primary" />
              <span class="text-primary font-semibold">{{ item.label }}</span>
            </a>
          } @else {
            <a [href]="item.url">
              <span class="text-color">{{ item.label }}</span>
            </a>
          }
        </ng-template>
      </p-breadcrumb>
    }
  `,
  styles: [
    `
      ::ng-deep nav.p-breadcrumb {
        background: none !important;
        border: none !important;
        padding: 0 !important;
      }
    `,
  ],
})
export class BreadcrumbsComponent implements OnInit, OnChanges {
  private metaTagsService = inject(MetaTagsService);

  @Input() breadcrumbs?: MenuItem[];
  @Input() pagePath?: string;
  public shouldShowBreadcrumbs = true;
  private navLinksMap: Record<string, ExtendedMenuItem> = {};

  ngOnInit(): void {
    this.flattenNavLinks();
    this.updateBreadcrumbs();
    this.generateBreadcrumbSchema();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pagePath'] && !changes['pagePath'].firstChange) {
      this.updateBreadcrumbs();
      this.generateBreadcrumbSchema();
    }
  }

  private generateBreadcrumbSchema() {
    if (!this.breadcrumbs || this.breadcrumbs.length === 0) return;

    const structuredData = this.breadcrumbs.map((breadcrumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: breadcrumb.label,
      item: `https://domain-locker.com${breadcrumb['route']}`,
    }));

    this.metaTagsService.addStructuredData('breadcrumb', structuredData);
  }

  public isDomainPage(path: string): boolean {
    const domainPattern = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,11}?$/;
    return domainPattern.test(path);
  }

  private updateBreadcrumbs(): void {
    // Check that we're on a page which isn't excluded from breadcrumbs
    this.shouldShowBreadcrumbs = this.determineIfBreadcrumbsShouldBeShown();

    // Generate breadcrumbs from page path, if breadcrumbs isn't already provided
    if (this.pagePath) {
      this.breadcrumbs = this.pagePath
        .split('?')[0]
        .split('/')
        .filter((path) => path)
        .map((path, index, paths) => {
          const cleanPath = path.split('?')[0].split('#')[0];
          return {
            label: this.getLabelForPath(cleanPath),
            route: this.getRouteForPath(
              paths.map((p) => p.split('?')[0]),
              index,
            ),
            icon: this.getIconForPath(cleanPath),
            svgIcon: this.getSvgIconForPath(cleanPath),
          };
        });
      this.breadcrumbs.unshift({ label: 'Home', route: '/', icon: 'pi pi-home' });
    }
  }

  private determineIfBreadcrumbsShouldBeShown(): boolean {
    if (!this.breadcrumbs && !this.pagePath) return false;
    const hideOnPages = ['/', '/about'];
    if (this.pagePath && !hideOnPages.includes(this.pagePath.split('?')[0])) return true;
    return false;
  }

  private getIconForPath(path: string) {
    if (this.navLinksMap[path] && this.navLinksMap[path].icon) {
      return this.navLinksMap[path].icon;
    }
    const icons: Record<string, string> = {
      settings: 'cog',
      about: 'lightbulb',
      contact: 'headphones',
      notifications: 'bell',
      'edit-events': 'list-check',
      pricing: 'money-bill',
      features: 'star',
      'external-tools': 'external-link',
      faq: 'question-circle',
      legal: 'hammer',
      developing: 'code',
      'self-hosting': 'server',
      alternatives: 'th-large',
      'domain-management': 'star-fill',
      attributions: 'heart-fill',
      'database-connection': 'database',
      error: 'exclamation-circle',
      'delete-data': 'trash',
      demo: 'desktop',
      support: 'headphones',
      'self-hosted-support': 'server',
      guides: 'book',
      advanced: 'bolt',
      'diagnostic-actions': 'wrench',
      'admin-links': 'link',
      'error-logs': 'exclamation-triangle',
      'debug-info': 'receipt',
      status: 'wave-pulse',
    };
    const iconName = icons[path];
    if (!iconName) return;
    return ` pi pi-${iconName}`;
  }

  private getSvgIconForPath(path: string) {
    if (this.navLinksMap[path] && this.navLinksMap[path].svgIcon) {
      return this.navLinksMap[path].svgIcon;
    }
    const icons: Record<string, string> = {};
    if (!icons[path]) return;
    return icons[path];
  }

  private getLabelForPath(path: string) {
    const labels: Record<string, string> = {
      certs: 'Certificates',
      dns: 'DNS Records',
      ips: 'IP Addresses',
      'edit-events': 'Edit Events',
      'external-tools': 'External Tools',
      faq: 'Frequently Asked Questions',
      about: 'Docs',
    };
    const formatLabel = (str: string) =>
      str.includes('.')
        ? str
        : str
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    path = decodeURIComponent(path);
    return labels[path] || formatLabel(path);
  }

  private getRouteForPath(paths: string[], index: number) {
    return paths.slice(0, index + 1).join('/');
  }

  private flattenNavLinks(): void {
    const addLinksToMap = (
      links: {
        routerLink?: string;
        label?: string;
        icon?: string;
        svgIcon?: string;
        items?: unknown[];
      }[],
    ) => {
      for (const link of links) {
        if (link.routerLink) {
          const path = link.routerLink.split('/').pop();
          if (path) {
            this.navLinksMap[path] = {
              label: link.label,
              icon: link.icon,
              svgIcon: link.svgIcon,
            };
          }
        }
        if (link.items) {
          addLinksToMap(link.items as Parameters<typeof addLinksToMap>[0]);
        }
      }
    };
    const allLinks = [
      ...(statsLinks as ExtendedMenuItem[]),
      ...settingsLinks,
      ...aboutLinks,
      ...authenticatedNavLinks,
      ...unauthenticatedNavLinks,
      ...toolsLinks,
    ];
    addLinksToMap(allLinks);
  }
}
