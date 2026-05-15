export const features = [
  {
    featureTitle: 'Track Assets',
    icon: 'track',
    featureInfo: [
      'We auto-fetch assets like SSL, hosts, registrars, IPs, DNS, subdomains.',
      'You can add additional context, like costs, tags, notes, and more.',
    ],
    screenshot: 'https://i.postimg.cc/9XBvJr7k/assets.png',
  },
  {
    featureTitle: 'Domain Data',
    icon: 'data',
    featureInfo: [
      'Dive into a detailed analysis of each of your domains.',
      'Security insights and recommended actions for each domain.',
    ],
    screenshot: 'https://i.postimg.cc/Bnvsx27N/domain.png',
  },

  {
    featureTitle: 'Stats',
    icon: 'chart',
    featureInfo: [
      'Visualize domain data with charts and analytics.',
      'Exportable maps, change timelines, provider breakdowns, and more.',
    ],
    screenshot: 'https://i.postimg.cc/T1mhvnvn/home-viz.png',
  },
  {
    featureTitle: 'Notifications',
    icon: 'notification',
    featureInfo: [
      'Alerts for expirations and configurable domain change notifications.',
      'Choose your method: email, webhook, push, Telegram, Signal, etc.',
    ],
    screenshot: 'https://i.postimg.cc/wxs1NYR3/settings-notifications.png',
  },
  {
    featureTitle: 'Data',
    icon: 'export',
    featureInfo: [
      'Access via API, Prometheus, iCal, RSS, or embeddable widgets (coming soon).',
      'Export your data anytime for migration or backup.',
    ],
    screenshot: 'https://i.postimg.cc/y6XztLwv/domain-grid-open.png',
  },
  {
    featureTitle: 'Track Changes',
    icon: 'logs',
    featureInfo: [
      'View audit logs for all domain changes.',
      'Track updates to security, host, SSL, DNS, WHOIS, and more.',
    ],
    screenshot: 'https://i.postimg.cc/52GcLTCN/vis-changes.png',
  },
  {
    featureTitle: 'Renewal Alerts',
    icon: 'expire',
    featureInfo: [
      'View timeline of upcoming expirations.',
      'Never miss a renewal deadline, with smart alerts.',
    ],
    screenshot: 'https://i.postimg.cc/wjFMz6Z4/notificiations.png',
  },
  {
    featureTitle: 'Monitor',
    icon: 'monitor',
    featureInfo: [
      'Monitor website health and performance.',
      'Track uptime, ping times, response codes and availability.',
    ],
    screenshot: 'https://i.postimg.cc/jddB9t6S/monitor.png',
  },
  {
    featureTitle: 'Security Check',
    icon: 'secure',
    featureInfo: [
      'Security insights and recommended actions for each domain',
      'Ensure your websites and domains have the correct security controls.',
    ],
    screenshot: 'https://i.postimg.cc/mkRWh9FY/statuses.png',
  },
  {
    featureTitle: 'Valuation',
    icon: 'value',
    featureInfo: [
      'Track purchase price, renewal costs, and current valuation.',
      'Manage upcoming payments and monitor profit/loss trends.',
    ],
    screenshot: 'https://i.postimg.cc/5yq1mgMK/valuation.png',
  },
  {
    featureTitle: 'Organize',
    icon: 'organize',
    featureInfo: [
      'Categorise domains in your portfolio with tags.',
      'Keep track of links, with all domain-related resources in one place.',
    ],
    screenshot: 'https://i.postimg.cc/4NsXxDzD/tags.png',
  },
  {
    featureTitle: 'Toolbox',
    icon: 'tools',
    featureInfo: [
      'AI-powered domain ideas, smart availability search, free valuation',
      'Enterprise-grade web analysis, monitoring and auditing tools',
    ],
  },
  // {
  //   featureTitle: 'Link',
  //   icon: 'links',
  //   featureInfo: [
  //     'Detailed map of your web presence, with automatically fetched assets.',
  //     'Never loose track of a specific URL for any of your domains, ever again.',
  //   ],
  // },
  {
    featureTitle: 'Customizable',
    icon: 'customize',
    iconViewBox: '0 0 576 512',
    featureInfo: [
      'Make the app yours, with customizable themes, fonts, layouts, and dark modes',
      'Multi-language support, with translations available for many languages.',
    ],
    screenshot: 'https://i.postimg.cc/zXFXwzzD/display.png',
  },
  {
    featureTitle: 'Private & Secure',
    icon: 'private',
    featureInfo: [
      'Full control of your data with easy import/export/deletion.',
      'SSO (GitHub, Google) and 2FA for extra security.',
      'No unnecessary data collection, transparent privacy policy.',
    ],
    screenshot: 'https://i.postimg.cc/TY63WLXH/privacy.png',
  },
  {
    featureTitle: 'Open Source',
    icon: 'open',
    featureInfo: [
      'Download, review, and improve our open-source code.',
      'Self-host Domain Locker on your own server.',
    ],
  },
  {
    featureTitle: 'Quality',
    icon: 'quality',
    featureInfo: [
      'Accessible, responsive, and lightning-fast.',
      'Well-documented and thoroughly tested for reliability.',
    ],
  },
];

// Additional features: Search,

// Alternatives: domainLocker, domainMod, domainWatchman, domainPunch
// Features: Auto-fetch data, keep up-to-date, track changes, notifications, valuation, monitor health, view stats, open source, multi-language support, custom UI

export interface Screenshot {
  screenshot: string; // The URL to the screenshot
  title: string; // Short title
  description: string; // Longer description
}

export const screenshots: Screenshot[] = [
  {
    screenshot: 'https://i.postimg.cc/GhXnhH3D/home-2.png',
    title: 'Domain Dashboard',
    description: 'All your domain names, neatly organised.',
  },
  {
    screenshot: 'https://i.postimg.cc/T1mhvnvn/home-viz.png',
    title: 'Stats',
    description: 'And visual analytics for a quick glance at your portfolio.',
  },
  {
    screenshot: 'https://i.postimg.cc/9M9cDVgh/change-history.png',
    title: 'Change History',
    description:
      'View a history of changes to your domains, including security, host, SSL, DNS, WHOIS, and more.',
  },
  {
    screenshot: 'https://i.postimg.cc/9XBvJr7k/assets.png',
    title: 'Track Assets',
    description:
      'View all of your assets (like auto-fetchedSSL, hosts, registrars, IPs, DNS, subdomains).',
  },
  {
    screenshot: 'https://i.postimg.cc/GhKd8XKH/add-link.png',
    title: 'Add Links',
    description:
      'You can associate links with domains, so you never lose track of a specific URL for any of your domains.',
  },
  {
    screenshot: 'https://i.postimg.cc/PqPXk1mN/bulk-add.png',
    title: 'Bulk Add',
    description: 'Got a lot of domains? You can bulk add them to your account.',
  },
  {
    screenshot: 'https://i.postimg.cc/d38QxvGB/developer.png',
    title: 'Data Connectors',
    description:
      "Want to fetch all your domain data programmatically? We've got APIs for that.",
  },
  {
    screenshot: 'https://i.postimg.cc/zXFXwzzD/display.png',
    title: 'Display options',
    description:
      'Choose your own theme, fonts, language, layout, and more display options, to make Domain Locker yours.',
  },
  {
    screenshot: 'https://i.postimg.cc/Bnvsx27N/domain.png',
    title: 'Domain Details',
    description: 'See all technical data about any of your domains.',
  },
  {
    screenshot: 'https://i.postimg.cc/y6XztLwv/domain-grid-open.png',
    title: 'Compare Domains',
    description: 'Compare domain settings side-by-side',
  },
  {
    screenshot: 'https://i.postimg.cc/m2LGsQ4R/domain-list.png',
    title: 'Change Domain View',
    description: 'View in a list, or grid. Choose which fields to show',
  },
  {
    screenshot: 'https://i.postimg.cc/7Y3bB1Vk/home-add.png',
    title: 'Add Domain',
    description: 'Adding new domain names to your account is easy',
  },
  {
    screenshot: 'https://i.postimg.cc/jddB9t6S/monitor.png',
    title: 'Monitor Uptime and Performance',
    description: 'View the health and availability of each website',
  },

  {
    screenshot: 'https://i.postimg.cc/L844Nc5t/notificiation-locations.png',
    title: 'Notification Channels',
    description: 'Choose how you want to be notified of important events.',
  },
  {
    screenshot: 'https://i.postimg.cc/13yXbgCN/settings-notifications-2.png',
    title: 'Notification Events',
    description:
      'Pick which events (domain changes, expirations, etc) you want to be notified about',
  },
  {
    screenshot: 'https://i.postimg.cc/wjFMz6Z4/notificiations.png',
    title: 'View Notifications',
    description: 'And see a history of all notifications',
  },

  {
    screenshot: 'https://i.postimg.cc/9fMMF6jm/export.png',
    title: 'Export',
    description: 'Download all of your data, at any time.',
  },
  {
    screenshot: 'https://i.postimg.cc/5yq1mgMK/valuation.png',
    title: 'Valuation',
    description: 'Keep track of purchase and renewal prices.',
  },
  {
    screenshot: 'https://i.postimg.cc/XJ90VLXN/registrars.png',
    title: 'Registrars',
    description: 'Never forget where a domain is registered.',
  },
  {
    screenshot: 'https://i.postimg.cc/6p1KzTDK/dns.png',
    title: 'DNS',
    description: 'View DNS settings for all your domains in one place.',
  },
  {
    screenshot: 'https://i.postimg.cc/R0kB5ySb/ips.png',
    title: 'IP Addresses',
    description: 'Easily see which server each of your domains points to.',
  },
  {
    screenshot: 'https://i.postimg.cc/yNgHGsHZ/hosts.png',
    title: 'Hosts',
    description: 'And where each domain is hosted',
  },
  {
    screenshot: 'https://i.postimg.cc/VsjY1fb9/subdomains.png',
    title: 'Subdomains',
    description: 'See all subdomains for each domain name',
  },
  {
    screenshot: 'https://i.postimg.cc/4NsXxDzD/tags.png',
    title: 'Tags',
    description: 'Organise domains by tags and categories',
  },
  {
    screenshot: 'https://i.postimg.cc/mkRWh9FY/statuses.png',
    title: 'Statuses',
    description: 'Get an overview of all security statues enabled for each domain',
  },
  {
    screenshot: 'https://i.postimg.cc/cCT2HbWW/vis-home.png',
    title: 'Data Visualisations',
    description: 'Get pretty charts of everything about your domains',
  },
  {
    screenshot: 'https://i.postimg.cc/4dkrFcPD/vis-providers.png',
    title: 'Providers',
    description: 'Get a snapshot of which registrars, SSL, and hosts your domains use',
  },
  {
    screenshot: 'https://i.postimg.cc/52GcLTCN/vis-changes.png',
    title: 'Change Cart',
    description: 'Visually see how often each domain changes',
  },
  {
    screenshot: 'https://i.postimg.cc/WzsxsPQS/vis-expirations.png',
    title: 'Expirations',
    description: 'Get a timeline or calendar of upcoming expirations',
  },
  {
    screenshot: 'https://i.postimg.cc/tT3L0gmY/vis-map.png',
    title: 'Map',
    description: 'See where each domain is hosted geographically',
  },
  {
    screenshot: 'https://i.postimg.cc/vm6Jzhr7/vis-statuses.png',
    title: 'Statuses',
    description: 'Get a breakdown of which security statuses are enabled for each domain',
  },
  {
    screenshot: 'https://i.postimg.cc/FH15fN1B/vis-timeline.png',
    title: 'Timeline',
    description: 'See dates for your next domains due to expire soon',
  },
  {
    screenshot: 'https://i.postimg.cc/fTnJjqYC/viz-cal.png',
    title: 'Calendar',
    description: 'Or view all renewal dates in a calendar view',
  },
  {
    screenshot: 'https://i.postimg.cc/HxFjNBRp/viz-tags.png',
    title: 'Tags',
    description: 'See your most popular domain categories',
  },
  {
    screenshot: 'https://i.postimg.cc/TY63WLXH/privacy.png',
    title: 'Privacy',
    description:
      'You are in full control of data, choose what is shared (nothing is shared by default).',
  },
  {
    screenshot: 'https://i.postimg.cc/P56XcSvB/profile.png',
    title: 'Account',
    description: 'Manage your account settings and more',
  },
  {
    screenshot: 'https://i.postimg.cc/dQd01Rgy/upgrade.png',
    title: 'Upgrade',
    description: 'Manage your billing, upgrade or downgrade at anytime',
  },
  {
    screenshot: 'https://i.postimg.cc/0jg2nrKj/delete.png',
    title: 'Deletion',
    description:
      'You are free to delete your data, account, and all associated data at any time.',
  },
  {
    screenshot: 'https://i.postimg.cc/tgMg1BXh/settings-db.png',
    title: 'Database',
    description: 'Connect to third-party or self-hosted databases.',
  },
  {
    screenshot: 'https://i.postimg.cc/Kz38ttzC/debug.png',
    title: 'Debug',
    description:
      "For developers and power users, we've got comprehensive debugging tools.",
  },
];

export enum Has {
  Yes = 1,
  No = -1,
  Some = 0,
}

export type Providers = 'domainLocker' | 'domainMod' | 'domainWatchman' | 'domainPunch';

export interface FeatureComparison {
  feature: string;
  description: string;
  icon?: string;
  comparison: Record<Providers, { has: Has; notes?: string }>;
}

export interface ProviderInfo {
  name: string;
  url: string;
  icon: string;
  summary: string;
}

export const providerInfo: Record<Providers, ProviderInfo> = {
  domainLocker: {
    name: 'Domain Locker',
    url: 'https://domain-locker.com',
    icon: 'https://domain-locker.com/icons/android-chrome-192x192.png',
    summary: '',
  },
  domainMod: {
    name: 'Domain Mod',
    url: 'https://domainmod.org',
    icon: 'https://github.com/homarr-labs/dashboard-icons/blob/a19b2ba31117a832e496777e863943802ff7fdc9/png/domainmod.png?raw=true',
    summary: '',
  },
  domainWatchman: {
    name: 'Domain Watchman',
    url: 'https://domainwatchman.com',
    icon: 'https://domainwatchman.com/android-chrome-192x192.png',
    summary: '',
  },
  domainPunch: {
    name: 'Domain Punch',
    url: 'https://domainpunch.com',
    icon: 'https://bcdn.domainpunch.com/images/icons/products/dppro.png',
    summary: '',
  },
};

export const alternativeComparison: FeatureComparison[] = [
  {
    feature: 'Auto-fetch data',
    description: '',
    comparison: {
      domainLocker: {
        has: Has.Yes,
        notes:
          'Registrar, SSL, DNS, IPs, Hosts and more is auto-fetched when you add a domain',
      },
      domainMod: {
        has: Has.Some,
        notes:
          'Data is entered manually when you add a domain, but there is auto-fetching functionality for keeping it up-to-date',
      },
      domainWatchman: {
        has: Has.Yes,
        notes:
          'Registrar, expiry and name servers are auto-fetched when you add a domain',
      },
      domainPunch: {
        has: Has.Yes,
        notes: '',
      },
    },
  },
  {
    feature: 'Data Updated Regularly',
    description: '',
    comparison: {
      domainLocker: {
        has: Has.Yes,
        notes: '',
      },
      domainMod: {
        has: Has.Yes,
        notes: '',
      },
      domainWatchman: {
        has: Has.No,
        notes: '',
      },
      domainPunch: {
        has: Has.Yes,
        notes: 'Yes, but manual refresh is required',
      },
    },
  },
  {
    feature: 'Track Changes',
    description: '',
    comparison: {
      domainLocker: {
        has: Has.Yes,
        notes:
          'View audit logs for all domain changes, including security, host, SSL, DNS, WHOIS, and more',
      },
      domainMod: {
        has: Has.No,
        notes: 'Data is updated, but there is no audit log',
      },
      domainWatchman: {
        has: Has.No,
        notes: '',
      },
      domainPunch: {
        has: Has.No,
        notes: '',
      },
    },
  },
  {
    feature: 'Alerts',
    description: '',
    comparison: {
      domainLocker: {
        has: Has.Yes,
        notes: 'Alerts for expirations or changes to SSL, host, registrar, etc.',
      },
      domainMod: {
        has: Has.Some,
        notes: 'Expiration emails',
      },
      domainWatchman: {
        has: Has.Some,
        notes: 'Expiration alerts',
      },
      domainPunch: {
        has: Has.Some,
        notes: 'DNS only',
      },
    },
  },
  {
    feature: 'Notifications Channels',
    description: '',
    comparison: {
      domainLocker: {
        has: Has.Yes,
        notes: 'Email, Slack, Telegram, Webhook, etc',
      },
      domainMod: {
        has: Has.Yes,
        notes: 'Email',
      },
      domainWatchman: {
        has: Has.Yes,
        notes: 'Email, Discord, Slack, Telegram',
      },
      domainPunch: {
        has: Has.No,
        notes: '',
      },
    },
  },
  {
    feature: 'Expiry Notifications',
    description: '',
    comparison: {
      domainLocker: {
        has: Has.Yes,
      },
      domainMod: {
        has: Has.Yes,
      },
      domainWatchman: {
        has: Has.Yes,
      },
      domainPunch: {
        has: Has.Yes,
      },
    },
  },
  {
    feature: 'Value Tracking',
    description: '',
    comparison: {
      domainLocker: {
        has: Has.Yes,
        notes: '',
      },
      domainMod: {
        has: Has.Yes,
        notes: '',
      },
      domainWatchman: {
        has: Has.No,
        notes: '',
      },
      domainPunch: {
        has: Has.Yes,
        notes: '',
      },
    },
  },
  {
    feature: 'Domain Health',
    description:
      'Track uptime, web status, response code, handshake, DNS resolution time',
    comparison: {
      domainLocker: {
        has: Has.Some,
        notes: 'Yes, but only on Pro plan',
      },
      domainMod: {
        has: Has.No,
        notes: '',
      },
      domainWatchman: {
        has: Has.No,
        notes: '',
      },
      domainPunch: {
        has: Has.No,
        notes: '',
      },
    },
  },
  {
    feature: 'Segements / Tags',
    description: 'Categories for domains into buckets',
    comparison: {
      domainLocker: {
        has: Has.Yes,
      },
      domainMod: {
        has: Has.Yes,
      },
      domainWatchman: {
        has: Has.Yes,
      },
      domainPunch: {
        has: Has.Yes,
      },
    },
  },
  {
    feature: 'Registrar API Access',
    description: 'Integrate with domain registrar API for advanced domain management',
    comparison: {
      domainLocker: {
        has: Has.No,
      },
      domainMod: {
        has: Has.Some,
      },
      domainWatchman: {
        has: Has.No,
      },
      domainPunch: {
        has: Has.No,
      },
    },
  },
  {
    feature: 'Stats',
    description: 'Visualize domain data with charts and analytics',
    comparison: {
      domainLocker: {
        has: Has.Yes,
        notes: '',
      },
      domainMod: {
        has: Has.No,
        notes: '',
      },
      domainWatchman: {
        has: Has.No,
        notes: '',
      },
      domainPunch: {
        has: Has.No,
        notes: '',
      },
    },
  },
  {
    feature: 'Open Source',
    description: 'The source code is available for download and review',
    comparison: {
      domainLocker: {
        has: Has.Yes,
      },
      domainMod: {
        has: Has.Yes,
      },
      domainWatchman: {
        has: Has.No,
      },
      domainPunch: {
        has: Has.No,
      },
    },
  },
  {
    feature: 'Multi-language Support',
    description: 'The UI is translatable into multiple locales',
    comparison: {
      domainLocker: {
        has: Has.Yes,
      },
      domainMod: {
        has: Has.Yes,
      },
      domainWatchman: {
        has: Has.No,
      },
      domainPunch: {
        has: Has.No,
      },
    },
  },
  {
    feature: 'Themable UI',
    description: 'The apps colors and layout can be adjusted according to preference',
    comparison: {
      domainLocker: {
        has: Has.Yes,
      },
      domainMod: {
        has: Has.No,
      },
      domainWatchman: {
        has: Has.No,
      },
      domainPunch: {
        has: Has.No,
      },
    },
  },
  {
    feature: 'Data Backup / Restore',
    description: 'Domain lists can be exported and imported with ease',
    comparison: {
      domainLocker: {
        has: Has.Yes,
      },
      domainMod: {
        has: Has.Yes,
      },
      domainWatchman: {
        has: Has.No,
      },
      domainPunch: {
        has: Has.Yes,
      },
    },
  },
];

export const businessFeatures = [
  {
    title: 'Cut Costs, Not Corners',
    emoji: '💰',
    subtitle: 'Stop overpaying for forgotten renewals and hidden registrar fees',
    description: `Track every domain's purchase price, renewal cost, and current value. 
    Domain Locker gives you full visibility into your domain portfolio's spend, 
    helping you cut unnecessary costs, avoid double registrations, 
    and make smarter decisions about what to keep and what to drop.`,
  },
  {
    title: 'Reduce Risk, Stay in Control',
    emoji: '🔒',
    subtitle: 'Avoid outages, security gaps, and costly mistakes',
    description: `SSL expiring? DNS misconfigured? WHOIS data changed without warning? 
    Domain Locker alerts you instantly when something important changes—so you catch 
    problems before they affect your business or reputation.`,
  },
  {
    title: 'Total Visibility, At a Glance',
    emoji: '👀',
    subtitle: 'All your domains, all your data, all in one place',
    description: `No more spreadsheets or guessing which registrar you used. 
    See your entire domain portfolio—registrars, expiry dates, SSLs, DNS records, tags, 
    valuations, and more—on a single dashboard. Knowledge is power, and now it's also easy.`,
  },
  {
    title: 'Save Hours Every Month',
    emoji: '⏱️',
    subtitle: 'Let the automation do the heavy lifting',
    description: `You shouldn't have to log in to five different panels or run 
    manual WHOIS and DNS checks. Domain Locker automatically fetches and monitors 
    all key data for each domain—leaving you more time to focus on your business, 
    not your backend.`,
  },
  {
    title: 'Smarter Decisions with Better Data',
    emoji: '📈',
    subtitle: 'Understand usage, performance, and security trends',
    description: `Track uptime, response times, DNS changes, and SSL history over time. 
    With charts and insights built in, Domain Locker helps you spot weak links 
    in your domain strategy—and fix them before they cost you.`,
  },
  {
    title: 'Built to Fit Your Business',
    emoji: '⚙️',
    subtitle: 'Customizable alerts, data export, and even self-hosting',
    description: `Choose how and where to get notified—email, Telegram, Signal, Slack, 
    webhook—and export your data anytime. Want full control? Self-host Domain 
    Locker with one click and run it on your own infrastructure.`,
  },
  {
    title: 'Complete Change History',
    emoji: '📊',
    subtitle: 'Full audit log for transparency and accountability',
    description: `Track every modification made to your domains—what changed, when, and why. 
    Domain Locker maintains a searchable, exportable audit trail that’s perfect 
    for internal reviews, compliance reporting, or tracing unexpected issues.`,
  },
  {
    title: 'Grows with Your Business',
    emoji: '📈',
    subtitle: 'Designed to scale from side project to full portfolio',
    description: `Whether you manage a single domain or hundreds across teams and 
    clients, Domain Locker adapts. It auto-fetches data, organizes everything neatly, 
    and keeps performance snappy even as your digital footprint expands.`,
  },
  {
    title: 'Compliance-Ready Domain Monitoring',
    emoji: '✅',
    subtitle: 'Meet your security and reporting obligations with ease',
    description: `From SSL expiry and WHOIS accuracy to audit logs and uptime tracking, 
    Domain Locker helps you stay compliant with standards like ISO 27001 and SOC 2. 
    Export reports, monitor critical changes, and keep a defensible record—automatically. 
    Dedicated enterprise instances running on your own infrastructure is also available.`,
  },
];
