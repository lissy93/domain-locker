import { MenuItem } from 'primeng/api';

export interface ExtendedMenuItem extends MenuItem {
  svgIcon?: string;
  description?: string;
  // [Symbol.iterator](): IterableIterator<ExtendedMenuItem>;
}

export const statsLinks: ExtendedMenuItem = [
  {
    label: 'Timeline',
    icon: 'pi pi-calendar',
    routerLink: '/stats/registration-timeline',
    description: 'Schedule chart illustrating the lifespan of all domains',
    color: 'blue',
  },
  {
    label: 'Map',
    icon: 'pi pi-map-marker',
    routerLink: '/stats/host-map',
    description: 'Geographical map showing where your domains are hosted',
    color: 'green',
  },
  {
    label: 'Domain Providers',
    icon: 'pi pi-chart-pie',
    routerLink: '/stats/domain-providers',
    description: 'Breakdown of domains with each registrar, SSL issuer and host',
    color: 'yellow',
  },
  {
    label: 'Security Profile',
    icon: 'pi pi-unlock',
    routerLink: '/stats/security-profile',
    description:
      'Proportion of which domains have valid domain security features enabled',
    color: 'cyan',
  },
  {
    label: 'Tag Cloud',
    icon: 'pi pi-tags',
    routerLink: '/stats/tag-cloud',
    description: 'Tags and domain count grouped by category',
    color: 'pink',
  },
  {
    label: 'SSL Lifespan',
    icon: 'pi pi-chart-bar',
    routerLink: '/stats/ssl-lifespan',
    description: 'Histogram illustrating SSL validity times',
    color: 'indigo',
  },
  {
    label: 'Subdomain Map',
    icon: 'pi pi-sitemap',
    routerLink: '/stats/tld-sub-map',
    description: 'Organisational chart listing subdomains for each domain',
    color: 'teal',
  },
  {
    label: 'Response Times',
    icon: 'pi pi-wave-pulse',
    routerLink: '/stats/uptime',
    description:
      'Heatmap of average historical response times and status codes for each site',
    color: 'orange',
  },
  {
    label: 'Change Frequency',
    icon: 'pi pi-history',
    routerLink: '/stats/change-frequency',
    description: 'Summary of recent changes recorded for each domain',
    color: 'purple',
  },
  {
    label: 'Payments Chart',
    icon: 'pi pi-credit-card',
    routerLink: '/stats/renewal-payments',
    description: 'Calendar of upcoming renewal payments',
    color: 'red',
  },
  {
    label: 'Domain Valuations',
    icon: 'pi pi-chart-scatter',
    routerLink: '/stats/cost-analysis',
    description: 'Bubble chart plotting domain value against cost',
    color: 'blue',
  },
  {
    label: 'Upcoming Expiries',
    icon: 'pi pi-clock',
    routerLink: '/stats/upcoming-expirations',
    description: 'Timeline of upcoming domain expirations and renewals',
    color: 'green',
  },
];

export const toolsLinks = [
  {
    label: 'Availability Search',
    icon: '',
    routerLink: '/tools/availability-search',
    svgIcon: 'availabilitySearch',
    description: 'Find all unregistered domains across extensions from your search term',
  },
  {
    label: 'Registrar Price Comparison',
    svgIcon: 'priceComparison',
    routerLink: '',
    description:
      'Find the lowest cost registrar for purchasing, renewing and transferring domains',
  },
  {
    label: 'Web Analysis',
    svgIcon: 'webAnalysis',
    routerLink: '',
    description:
      'Get a detailed report on the security, configuration and architecture of a website',
  },
  {
    label: 'Domain Name Valuation',
    svgIcon: 'domainValuation',
    routerLink: '',
    description: 'Estimate the value of a domain based on a variety of factors',
  },
  {
    label: 'Smart Domain Finder',
    svgIcon: 'domainFinder',
    routerLink: '',
    description:
      'AI-powered smart search, to help you discover new domains based on your criteria',
  },
];

export const settingsLinks = [
  { label: 'Account Settings', icon: 'pi pi-user-edit', routerLink: '/settings/account' },
  {
    label: 'Notification Preferences',
    icon: 'pi pi-bell',
    routerLink: '/settings/notification-preferences',
  },
  {
    label: 'Display Options',
    icon: 'pi pi-palette',
    routerLink: '/settings/display-options',
  },
  {
    label: 'Privacy and Data',
    icon: 'pi pi-eye-slash',
    routerLink: '/settings/privacy-settings',
  },
  { label: 'Manage Plan', icon: 'pi pi-shop', routerLink: '/settings/upgrade' },
  {
    label: 'Developer Options',
    icon: 'pi pi-code',
    routerLink: '/settings/developer-options',
  },
  {
    label: 'Danger Zone',
    icon: 'pi pi-exclamation-triangle',
    routerLink: '/settings/delete-account',
  },
];

export const aboutLinks = [
  { label: 'Announcements', icon: 'pi pi-megaphone', routerLink: '/about/announcements' },
  { label: 'Get Help', icon: 'pi pi-question-circle', routerLink: '/about/get-help' },
  { label: 'License and Terms', icon: 'pi pi-hammer', routerLink: '/about/license' },
];

export const authenticatedNavLinks = [
  {
    label: 'Domains',
    icon: 'pi pi-fw pi-globe',
    routerLink: '/domains',
    items: [
      {
        label: 'Inventory',
        icon: 'pi pi-briefcase',
        routerLink: '/domains',
      },
      {
        label: 'Monitor',
        icon: 'pi pi-wave-pulse',
        routerLink: '/monitor',
      },
      {
        label: 'Valuation',
        icon: 'pi pi-money-bill',
        routerLink: '/value',
      },
      {
        label: 'Change History',
        icon: 'pi pi-history',
        routerLink: '/domains/change-history',
      },
      {
        label: 'Search',
        icon: 'pi pi-fw pi-search',
        routerLink: '/search',
      },
      {
        label: 'Add or Export',
        icon: 'pi pi-fw pi-truck',
        items: [
          {
            label: 'Add Domain',
            icon: 'pi pi-fw pi-plus',
            routerLink: '/domains/add',
          },
          {
            label: 'Quick Add',
            icon: 'pi pi-fw pi-plus-circle',
            routerLink: '/domains/add/quick-add',
          },
          {
            label: 'Bulk Import',
            icon: 'pi pi-fw pi-upload',
            routerLink: '/domains/add/bulk-add',
          },
          {
            label: 'Bulk Export',
            icon: 'pi pi-download',
            routerLink: '/domains/export',
          },
          {
            label: 'Programmatic Access',
            icon: 'pi pi pi-code',
            routerLink: '/settings/developer-options',
          },
          {
            label: 'Data Deletion',
            icon: 'pi pi pi-trash',
            routerLink: '/settings/delete-account',
          },
        ],
      },
    ],
  },
  {
    label: 'Assets',
    icon: 'pi pi-box',
    routerLink: '/assets',
    items: [
      {
        label: 'Registrars',
        icon: 'pi pi-fw pi-receipt',
        routerLink: '/assets/registrars',
      },
      {
        label: 'Hosts',
        icon: 'pi pi-fw pi-server',
        routerLink: '/assets/hosts',
      },
      {
        label: 'Certificates',
        icon: 'pi pi-fw pi-key',
        routerLink: '/assets/certs',
      },
      {
        label: 'IPs',
        icon: 'pi pi-fw pi-sitemap',
        routerLink: '/assets/ips',
      },
      {
        label: 'DNS',
        icon: 'pi pi-fw pi-table',
        routerLink: '/assets/dns',
      },
      {
        label: 'Subdomains',
        icon: 'pi pi-fw pi-arrows-v',
        routerLink: '/assets/subdomains',
      },
      {
        label: 'Tags',
        icon: 'pi pi-fw pi-tags',
        routerLink: '/assets/tags',
      },
      {
        label: 'Links',
        icon: 'pi pi-fw pi-link',
        routerLink: '/assets/links',
      },
      {
        label: 'Security',
        icon: 'pi pi-fw pi-shield',
        routerLink: '/assets/statuses',
      },
    ],
  },
  {
    label: 'Statistics',
    icon: 'pi pi-fw pi-sparkles',
    routerLink: '/stats',
    // items: statsLinks,
  },
];

export const unauthenticatedNavLinks = [
  {
    label: 'Docs',
    icon: 'pi pi-fw pi-book',
    routerLink: '/about',
    // items: [
    //   {
    //     label: 'Helpful Articles',
    //     routerLink: '/about/articles',
    //     icon: 'pi pi-folder-open',
    //   },
    //   {
    //     label: 'External Links',
    //     routerLink: '/about/external-links',
    //     icon: 'pi pi-paperclip',
    //   },
    //   {
    //     label: 'Support',
    //     routerLink: '/about/support',
    //     icon: 'pi pi-question-circle',
    //   },
    //   {
    //     label: 'Legal Documents',
    //     routerLink: '/about/legal',
    //     icon: 'pi pi-hammer',
    //   },
    //   {
    //     label: 'Self-Hosting',
    //     routerLink: '/about/self-hosting',
    //     icon: 'pi pi-server',
    //   },
    //   {
    //     label: 'Community',
    //     routerLink: '/about/community',
    //     icon: 'pi pi-users',
    //   },
    //   {
    //     label: 'Developer Guides',
    //     routerLink: '/about/developing',
    //     icon: 'pi pi-code',
    //   },
    // ],
  },
  {
    label: 'Features',
    icon: 'pi pi-fw pi-star',
    routerLink: '/about/features',
  },
  {
    label: 'Pricing',
    icon: 'pi pi-fw pi-money-bill',
    routerLink: '/about/pricing',
  },
  {
    label: 'GitHub',
    icon: 'pi pi-fw pi-github',
    url: 'https://github.com/lissy93/domain-locker',
  },
  {
    label: 'Login',
    icon: 'pi pi-fw pi-sign-in',
    routerLink: '/login',
  },
];
