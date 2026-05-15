import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';

interface LinkItem {
  title: string;
  description?: string;
  icon: string;
  link: string;
  external?: boolean;
}

interface Section {
  heading: string;
  items: LinkItem[];
}

@Component({
  standalone: true,
  selector: 'app-advanced-page',
  imports: [PrimeNgModule],
  templateUrl: './index.page.html',
  styles: [
    `
      :host ::ng-deep {
        .p-accordion {
          margin-top: 1rem;
          .p-accordion-header {
            .p-accordion-header-link {
              padding: 1.5rem 0 1rem 0;
              border: none;
              .p-accordion-header-text {
                font-size: 1.5rem;
              }
            }
            a {
              background-color: var(--surface-0);
              color: var(--text-color);
              font-weight: 600;

              &:hover {
                background-color: var(--surface-0);
                opacity: 0.8;
              }
            }
          }

          .p-accordion-content {
            background-color: var(--surface-0);
            color: var(--text-color);
            border: none;
            padding: 0;
          }
        }
      }
    `,
  ],
})
export default class AdvancedIndexPage {
  public sections: Section[] = [
    {
      heading: 'Troubleshooting',
      items: [
        {
          title: 'Service Status',
          icon: 'pi pi-wave-pulse',
          link: '/advanced/status',
        },
        {
          title: 'Debug Info',
          icon: 'pi pi-receipt',
          link: '/advanced/debug-info',
        },
        {
          title: 'Diagnostic Actions',
          icon: 'pi pi-wrench',
          link: '/advanced/diagnostic-actions',
        },
        {
          title: 'Error Logs',
          icon: 'pi pi-exclamation-triangle',
          link: '/advanced/error-logs',
        },
        {
          title: 'Database Connection',
          icon: 'pi pi-database',
          link: '/advanced/database-connection',
        },
        {
          title: 'Admin Links',
          icon: 'pi pi-link',
          link: '/advanced/admin-links',
        },
      ],
    },
    {
      heading: 'Data',
      items: [
        {
          title: 'Data Deletion',
          icon: 'pi pi-trash',
          link: '/advanced/delete-data',
        },
        {
          title: 'Data Export',
          icon: 'pi pi-file-export',
          link: '/domains/export',
        },
        {
          title: 'Data Interoperability',
          icon: 'pi pi-arrows-h',
          link: '/settings/developer-options',
        },
        {
          title: 'Data Deep Search',
          icon: 'pi pi-search',
          link: '/search',
        },
        {
          title: 'Bulk Import',
          icon: 'pi pi-file-import',
          link: '/domains/add/bulk-add',
        },
        {
          title: 'Privacy Policy',
          icon: 'pi pi-key',
          link: '/about/legal/privacy-policy',
        },
      ],
    },
    {
      heading: 'Docs & Help',
      items: [
        {
          title: 'Developer Docs',
          icon: 'pi pi-code',
          link: '/about/developing',
        },
        {
          title: 'Self-Hosting Docs',
          icon: 'pi pi-server',
          link: '/about/self-hosting',
        },
        {
          title: 'Legal Info',
          icon: 'pi pi-briefcase',
          link: '/about/legal',
        },
        {
          title: 'GitHub (source code)',
          icon: 'pi pi-github',
          link: 'https://github.com/lissy93/domain-locker',
          external: true,
        },
        {
          title: 'Support (premium)',
          icon: 'pi pi-phone',
          link: '/about/support',
        },
        {
          title: 'More Docs...',
          icon: 'pi pi-ellipsis-h',
          link: '/about',
        },
      ],
    },
    {
      heading: 'User Settings',
      items: [
        {
          title: 'Account Options',
          icon: 'pi pi-user-edit',
          link: '/settings/account',
        },
        {
          title: 'Notification Preferences',
          icon: 'pi pi-bell',
          link: '/settings/notification-preferences',
        },
        {
          title: 'Display Options',
          icon: 'pi pi-palette',
          link: '/settings/display-options',
        },
        {
          title: 'Privacy Protections',
          icon: 'pi pi-eye-slash',
          link: '/settings/privacy-settings',
        },
        {
          title: 'Billing',
          icon: 'pi pi-shop',
          link: '/settings/upgrade',
        },
        {
          title: 'More Settings...',
          icon: 'pi pi-ellipsis-h',
          link: '/settings',
        },
      ],
    },
  ];
}
