export interface LinkItem {
  purpose: string;
  provider: string;
  url: string;
  description?: string;
  upstreamSite?: string;
}

export const selfHostedLinks: LinkItem[] = [
  {
    purpose: 'Container',
    provider: 'Docker',
    url: 'https://docs.docker.com/',
    description: 'Runtime environment',
  },
  {
    purpose: 'Database',
    provider: 'Postgres',
    url: 'https://www.postgresql.org/docs/current/',
    description: 'Database server',
  },
  {
    purpose: 'App',
    provider: 'Domain Locker',
    url: 'https://github.com/lissy93/domain-locker',
    description: 'The client and server-side app for Domain Locker',
    upstreamSite: 'https://domain-locker.com/',
  },
];

export const downloadLinks: LinkItem[] = [
  {
    purpose: 'Container',
    provider: 'DockerHub',
    url: 'https://hub.docker.com/r/lissy93/domain-locker',
    description: 'Domain Locker container for Docker deployments',
  },
  {
    purpose: 'Helm Chart',
    provider: 'ArtifactHub',
    url: 'https://artifacthub.io/packages/helm/domain-locker/domain-locker',
    description: 'Domain Locker Helm Chart for Kubernetes deployments',
  },
  {
    purpose: 'App',
    provider: 'Umbrel',
    url: 'https://apps.umbrel.com/app/domain-locker',
    description: 'Domain Locker Umbrel app for UmbrelOS deployments',
  },
];

export const serviceLinks: LinkItem[] = [
  {
    purpose: 'Database',
    provider: 'Supabase',
    url: 'https://supabase.com/dashboard',
    description: 'Postgres DB, auth and edge functions',
  },
  {
    purpose: 'Email',
    provider: 'Resend',
    url: 'https://resend.com/emails',
    description: 'STMP email sending',
  },
  {
    purpose: 'Payments',
    provider: 'Stripe',
    url: 'https://dashboard.stripe.com',
    description: 'Payment processing and subscriptions',
  },
  {
    purpose: 'SMS',
    provider: 'Twilio',
    url: 'https://console.twilio.com',
    description: 'SMS and WhatsApp notification sending',
  },
  {
    purpose: 'DNS',
    provider: 'Cloudflare',
    url: 'https://dash.cloudflare.com',
    description: 'Registrar, DNS, WAF and bot protection',
  },
  {
    purpose: 'Hosting',
    provider: 'Vercel',
    url: 'https://vercel.com',
    description: 'HTTP server for client app and API',
  },
  {
    purpose: 'Error Logs',
    provider: 'Glitchtip',
    url: 'https://glitch.as93.net',
    description: 'Error logging, tracing and alerts',
  },
  {
    purpose: 'Analytics',
    provider: 'Plausible',
    url: 'https://no-track.as93.net',
    description: 'Hit counting and zero-tracking usage stats',
  },
  {
    purpose: 'Status',
    provider: 'Kuma',
    url: 'https://uptime.as93.net/',
    description: 'Uptime and availability monitoring',
    upstreamSite: 'https://uptime.kuma.pet/',
  },
  {
    purpose: 'Feedback',
    provider: 'Formbricks',
    url: 'https://app.formbricks.com/',
    description: 'User surveys and feedback collection',
    upstreamSite: 'https://formbricks.com/',
  },
  {
    purpose: 'Support',
    provider: 'Freshdesk',
    url: 'https://as93.freshdesk.com/',
    description: 'Customer support and ticketing',
    upstreamSite: 'https://www.freshworks.com/',
  },
  {
    purpose: 'Source',
    provider: 'GitHub',
    url: 'https://github.com/Lissy93/domain-locker',
    description: 'Sourcecode VCS, releases, tickets and CI/CD',
  },
  // {
  //   purpose: 'Monitoring',
  //   provider: 'Grafana',
  //   url: '#',
  //   description: 'System logs, alerts and metrics',
  //   upstreamSite: 'https://grafana.com/',
  // },
];

export const documentationLinks: LinkItem[] = [
  {
    purpose: 'Language',
    provider: 'TypeScript',
    url: 'https://www.typescriptlang.org/docs/',
    description: 'Typed JavaScript superset',
  },
  {
    purpose: 'Framework',
    provider: 'Angular',
    url: 'https://angular.io/docs',
    description: 'Web application framework',
  },
  {
    purpose: 'Build Tool',
    provider: 'Vite',
    url: 'https://vite.dev/',
    description: 'App bundler and build tool',
  },
  {
    purpose: 'Meta-Framework',
    provider: 'Analog',
    url: 'https://analogjs.org/docs',
    description: 'Full-stack SSR framework',
  },
  {
    purpose: 'Components',
    provider: 'PrimeNG',
    url: 'https://primeng.org/',
    description: 'UI component library',
  },
  {
    purpose: 'Internationalization',
    provider: 'ngx-translate',
    url: 'https://ngx-translate.org/',
    description: 'i18n for translations of in-app copy',
  },
  {
    purpose: 'Styling Classes',
    provider: 'Tailwind',
    url: 'https://tailwindcss.com/docs',
    description: 'Utility-first CSS styles',
  },
  {
    purpose: 'Styling Preprocessor',
    provider: 'SCSS',
    url: 'https://sass-lang.com/guide',
    description: 'CSS preprocessor syntax',
  },
  {
    purpose: 'Async Library',
    provider: 'RxJS',
    url: 'https://rxjs.dev/',
    description: 'Reactive data observables',
  },
  {
    purpose: 'Server Toolkit',
    provider: 'Nitro',
    url: 'https://nitro.unjs.io/',
    description: 'Vendor-agnostic web server',
  },
  {
    purpose: 'Charting',
    provider: 'D3.js',
    url: 'https://d3js.org/',
    description: 'Charting and data visualizations',
  },
  {
    purpose: 'Search',
    provider: 'Fuse.js',
    url: 'https://www.fusejs.io/',
    description: 'Fuzzy searching for filtering',
  },
];
