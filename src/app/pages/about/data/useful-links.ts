export interface WebTool {
  title: string;
  link: string;
  icon: string;
  description: string;
}

export const helpfulToos: WebTool[] = [];

export const as93Apps: WebTool[] = [
  {
    title: 'Web Check',
    link: 'https://web-check.xyz',
    icon: 'https://github.com/Lissy93/web-check/blob/master/public/web-check.png?raw=true',
    description:
      'X-ray vision for any website, view and export all available website data in one place',
  },
  {
    title: 'Dashy',
    link: 'https://dashy.to',
    description:
      'A self-hostable server dashboard. Status-checking, widgets, themes, icon packs, UI editor, and more',
    icon: 'https://i.ibb.co/yhbt6CY/dashy.png',
  },
  {
    title: 'Who Dat?',
    link: 'https://who-dat.as93.net/',
    description: 'Free & open source WHOIS lookup app and API',
    icon: 'https://i.ibb.co/J5r1zCP/who-dat-square.png',
  },
  {
    title: 'Digital Defense',
    link: 'https://digital-defense.io/',
    icon: 'https://i.ibb.co/Rb6P6h6/shield.png',
    description:
      'The ultimate security checklist, 300+ tips for protecting your data online',
  },
  {
    title: 'Awesome Privacy',
    link: 'https://awesome-privacy.xyz/',
    icon: 'https://lissy93.github.io/awesome-privacy/awesome-privacy.png',
    description:
      'A curated list of apps, services and alternatives that respect your privacy',
  },
  {
    title: 'Portainer Templates',
    description: 'A collection of 1-click installable Docker stacks',
    icon: 'https://i.ibb.co/hMymwH0/portainer-templates-small.png',
    link: 'https://portainer-templates.as93.net/',
  },
  {
    title: 'Adguardian',
    description: 'A CLI network traffic monitor and dashboard for AdGuard Home',
    icon: 'https://github.com/Lissy93/AdGuardian-Term/blob/website/static/favicon.png?raw=true',
    link: 'https://adguardian.as93.net/',
  },
  {
    title: 'Email Comparison',
    icon: 'https://i.ibb.co/pPFh021/email-comparison-icon.png',
    description: 'An objective comparison of private and/or secure email services ',
    link: 'https://email-comparison.as93.net/',
  },
];

export const domainTools: WebTool[] = [
  {
    title: 'Domcomp',
    link: 'https://domcomp.com',
    icon: 'https://icon.horse/icon/domcomp.com',
    description: 'Domain registrar comparison tool',
  },
  {
    title: 'Humbleworth',
    link: 'https://humbleworth.com',
    icon: 'https://humbleworth.com/favicon.png',
    description: 'Free domain appraisal tool, to find approximate value of a domain',
  },
  {
    title: 'Name Boy',
    link: 'https://www.nameboy.com/',
    icon: 'https://www.nameboy.com/wp-content/themes/nameboy/assets/images/favicon-192.png',
    description: 'Discover available domain name from search term',
  },
  {
    title: 'Expired Domains',
    link: 'https://www.expireddomains.net/',
    icon: 'https://icon.horse/icon/expireddomains.net',
    description: 'List of all domains that have expired today',
  },
];

export const openSourceUtils = [
  {
    title: 'gabe565/domain-watch',
    link: 'https://github.com/gabe565/domain-watch',
    icon: 'https://github.com/gabe565/domain-watch/raw/main/assets/icon.svg',
    description: 'Get notified of domain changes when they happen',
  },
  {
    title: 'maelgangloff/domain-watchdog',
    link: 'https://github.com/maelgangloff/domain-watchdog',
    icon: 'https://github.com/user-attachments/assets/942ddfd0-2c76-4b00-bd9f-727cfddc0103',
    description: 'Collect domain data and track change history',
  },
  {
    title: 'dehydrated-io/dehydrated',
    link: 'https://github.com/dehydrated-io/dehydrated',
    icon: 'https://github.com/dehydrated-io/dehydrated/raw/master/docs/logo.png',
    description: 'A client for signing certificates with an ACME server',
  },
  {
    title: 'dyne/gitzone',
    link: 'https://github.com/dyne/gitzone',
    icon: 'https://dyne.org/favicon.svg',
    description: 'Git-based DNS management tool for BIND9',
  },
  {
    title: 'EFForg/Certbot',
    link: 'https://github.com/certbot/certbot',
    icon: 'https://dashboard.snapcraft.io/site_media/appmedia/2020/09/certbot.png',
    description: "Automatically enable HTTPS on your website with Let's Encrypt",
  },
];

export const registrars: WebTool[] = [
  {
    title: 'Porkbun',
    link: 'https://porkbun.com/',
    icon: 'https://porkbun.com/partners/logos/porkbun.comphpPkl2eU.svg',
    description: 'Simple, transparent, affordable registrar',
  },
  {
    title: 'Spaceship',
    link: 'https://www.spaceship.com/',
    icon: 'https://spaceship-cdn.com/static/spaceship/favicon/apple-touch-icon-180x180.png',
    description: 'Affordable modern registrar with no lock-ins',
  },
  {
    title: 'Hover',
    link: 'https://www.hover.com/',
    icon: 'https://www.hover.com/apple-touch-icon-114x114.png',
    description: 'An easy and affordable registrar with good customer support',
  },
  {
    title: 'Namecheap',
    link: 'https://www.namecheap.com',
    icon: 'https://www.namecheap.com/assets/img/nc-icon/namecheap-icon-144x144.png',
    description:
      'Well established, but quite expensive registrar with many TLDs + WHOIS privacy included',
  },
  {
    title: 'Cloudflare Registrar',
    link: 'https://domains.cloudflare.com/',
    icon: 'https://domains.cloudflare.com/favicon.svg',
    description:
      "Low pricing, good if you're already using Cloudflare for DDoS protection",
  },
];

export const sslCerts: WebTool[] = [
  {
    title: "Let's Encrypt",
    link: 'https://letsencrypt.org/',
    icon: 'https://letsencrypt.org/favicon.ico',
    description: 'Industry leading free and automated SSL certs',
  },
  {
    title: 'ZeroSSL',
    link: 'https://zerossl.com/',
    icon: 'https://zerossl.com/assets/images/zerossl_icon.png',
    description: 'Free SSL 90-day certificates with wildcard support',
  },
  {
    title: 'Cloudflare SSL',
    link: 'https://www.cloudflare.com/ssl/',
    icon: 'https://www.cloudflare.com/favicon.ico',
    description: "Free SSL via Cloudflare's reverse proxy",
  },
];

export const domainManagementPlatforms: WebTool[] = [
  {
    title: 'Domain MOD',
    link: 'https://domainmod.org',
    icon: 'https://github.com/homarr-labs/dashboard-icons/blob/a19b2ba31117a832e496777e863943802ff7fdc9/png/domainmod.png?raw=true',
    description:
      'The self-hosted domain management platform with a data warehouse framework',
  },
  {
    title: 'Domain Punch',
    link: 'https://domainpunch.com',
    icon: 'https://bcdn.domainpunch.com/images/icons/products/dppro.png',
    description: 'Desktop tool for managing large domain portfolios',
  },
  {
    title: 'Domain Watchman',
    link: 'https://domainwatchman.com',
    icon: 'https://domainwatchman.com/android-chrome-192x192.png',
    description: 'Expiration monitor and domain management platform',
  },
  {
    title: 'Domain Locker',
    link: 'https://domain-locker.com',
    icon: 'https://domain-locker.com/icons/android-chrome-192x192.png',
    description:
      'The all-in-one domain management platform, for keeping track of your domain portfolio, associated assets, and more',
  },
  {
    title: 'Domain Admin',
    link: 'https://domain-admin.cn/',
    icon: 'https://demo.domain-admin.cn/favicon.ico',
    description: 'Lightweight renewal and SSL expiration monitor with notifications',
  },
  {
    title: 'Domain Ant',
    link: 'https://domant.me/',
    icon: 'https://domant.me/wp-content/uploads/2024/03/domant-favicon-150x150.png',
    description: 'Notifications and domain tracking (Not yet GA at time of writing)',
  },
  {
    title: 'Momento',
    link: 'https://getmomento.io/',
    icon: 'https://d2f3g3eizvjo68.cloudfront.net/favicon.png',
    description: 'Monitors for domain expiration and SSL certificate expiration',
  },
];

export const domainOsintTools: WebTool[] = [
  {
    title: 'Web Check',
    link: 'https://web-check.xyz',
    icon: 'https://github.com/Lissy93/web-check/blob/master/public/web-check.png?raw=true',
    description:
      'X-ray vision for any website, view and export all available website data in one place',
  },
  {
    title: 'MX Toolbox',
    link: 'https://mxtoolbox.com/SuperTool.aspx',
    icon: 'https://icon.horse/icon/mxtoolbox.com',
    description: 'Check DNS records, blacklist status, and more',
  },
  {
    title: 'Zone Master',
    link: 'https://zonemaster.net/en/run-test',
    icon: 'https://zonemaster.net/en/assets/favicon/zonemaster_57x57.png',
    description: 'DNS diagnostics tool',
  },
  {
    title: 'Hudson Rock',
    link: 'https://hudsonrock.com/free-tools/?=webcheck',
    icon: 'https://pixelflare.cc/alicia/icons/hudson-rock.png/w128',
    description: 'Identify Infostealer infection data related to domains and emails',
  },
  {
    title: 'SSL Labs Test',
    link: 'https://ssllabs.com/ssltest/analyze.html',
    icon: 'https://pixelflare.cc/alicia/icons/qualys-ssl-labs.png/w128',
    description: 'Analyzes the SSL configuration of a server and grades it',
  },
  {
    title: 'Virus Total',
    link: 'https://virustotal.com',
    icon: 'https://pixelflare.cc/alicia/icons/virustotal.png/w128',
    description: 'Checks a URL against multiple antivirus engines',
  },
  {
    title: 'Shodan',
    link: 'https://shodan.io/',
    icon: 'https://pixelflare.cc/alicia/icons/shodan.png/w128',
    description: 'Search engine for Internet-connected devices',
  },
  {
    title: 'Archive',
    link: 'https://archive.org/',
    icon: 'https://pixelflare.cc/alicia/icons/internet-archive.png/w128',
    description: 'View previous versions of a site via the Internet Archive',
  },
  {
    title: 'URLScan',
    link: 'https://urlscan.io/',
    icon: 'https://pixelflare.cc/alicia/icons/urlscan.png/w128',
    description: 'Scans a URL and provides information about the page',
  },
  {
    title: 'Sucuri SiteCheck',
    link: 'https://sitecheck.sucuri.net/',
    icon: 'https://pixelflare.cc/alicia/icons/sucuri.png/w128',
    description: 'Checks a URL against blacklists and known threats',
  },
  {
    title: 'Domain Tools',
    link: 'https://whois.domaintools.com/',
    icon: 'https://pixelflare.cc/alicia/icons/domaintools.png/w128',
    description: 'Run a WhoIs lookup on a domain',
  },
  {
    title: 'NS Lookup',
    link: 'https://nslookup.io/',
    icon: 'https://pixelflare.cc/alicia/icons/nslookup.png/w128',
    description: 'View DNS records for a domain',
  },
  {
    title: 'DNS Checker',
    link: 'https://dnschecker.org/',
    icon: 'https://pixelflare.cc/alicia/icons/dns-checker.png/w128',
    description: 'Check global DNS propagation across multiple servers',
  },
  {
    title: 'Censys',
    link: 'https://search.censys.io/',
    icon: 'https://pixelflare.cc/alicia/icons/censys.png/w128',
    description: 'Lookup hosts associated with a domain',
  },
  {
    title: 'Page Speed Insights',
    link: 'https://developers.google.com/speed/pagespeed/insights/',
    icon: 'https://pixelflare.cc/alicia/icons/page-speed-insights.png/w128',
    description:
      'Checks the performance, accessibility and SEO of a page on mobile + desktop',
  },
  {
    title: 'Built With',
    link: 'https://builtwith.com/',
    icon: 'https://pixelflare.cc/alicia/icons/built-with.png/w128',
    description: 'View the tech stack of a website',
  },
  {
    title: 'DNS Dumpster',
    link: 'https://dnsdumpster.com/',
    icon: 'https://pixelflare.cc/alicia/icons/dnsdumpster.png/w128',
    description: "DNS recon tool, to map out a domain from it's DNS records",
  },
  {
    title: 'BGP Tools',
    link: 'https://bgp.tools/',
    icon: 'https://pixelflare.cc/alicia/icons/bgp-tools.png/w128',
    description: 'View realtime BGP data for any ASN, Prefix or DNS',
  },
  {
    title: 'Similar Web',
    link: 'https://similarweb.com/',
    icon: 'https://pixelflare.cc/alicia/icons/similar-web.png/w128',
    description: 'View approx traffic and engagement stats for a website',
  },
  {
    title: 'Blacklist Checker',
    link: 'https://blacklistchecker.com/',
    icon: 'https://pixelflare.cc/alicia/icons/black-list-checker.png/w128',
    description: 'Check if a domain, IP or email is present on the top blacklists',
  },
  {
    title: 'Cloudflare Radar',
    link: 'https://radar.cloudflare.com/',
    icon: 'https://pixelflare.cc/alicia/icons/cloudflare.png/w128',
    description: 'View traffic source locations for a domain through Cloudflare',
  },
  {
    title: 'Mozilla HTTP Observatory',
    link: 'https://developer.mozilla.org/en-US/observatory',
    icon: 'https://pixelflare.cc/alicia/icons/mozilla.png/w128',
    description:
      'Assesses website security posture by analyzing various security headers and practices',
  },
  {
    title: 'AbuseIPDB',
    link: 'https://abuseipdb.com/',
    icon: 'https://pixelflare.cc/alicia/icons/abuseipdb.png/w128',
    description: "Checks a website against Zscaler's dynamic risk scoring engine",
  },
  {
    title: 'IBM X-Force Exchange',
    link: 'https://exchange.xforce.ibmcloud.com/',
    icon: 'https://pixelflare.cc/alicia/icons/ibm-x-force-exchange.png/w128',
    description: 'View shared human and machine generated threat intelligence',
  },
  {
    title: 'URLVoid',
    link: 'https://urlvoid.com/',
    icon: 'https://pixelflare.cc/alicia/icons/urlvoid.png/w128',
    description:
      'Checks a website across 30+ blocklist engines and website reputation services',
  },
  {
    title: 'URLhaus',
    link: 'https://urlhaus.abuse.ch/',
    icon: 'https://pixelflare.cc/alicia/icons/urlhaus.png/w128',
    description: "Checks if the site is in URLhaus's malware URL exchange",
  },
];

const _infoSitesAndArticles: WebTool[] = [
  {
    title: 'DN.org',
    link: 'https://dn.org',
    icon: 'https://dn.org/favicon.ico',
    description: 'The Domain Name encyclopedia - guides for investing in domains',
  },
];

export const sections = [
  {
    title: 'Domain Tools',
    description: 'Free tools for finding, comparing and valuing domain names',
    links: domainTools,
  },
  {
    title: 'Web Data Tools',
    description: `
      Free tools for discovering data about any site.
      Useful for analyzing, debugging, optimizing securing your domains and websites.
    `,
    links: domainOsintTools,
  },
  {
    title: 'Reputable Registrars',
    description: `
      <span>The most important decision you can make when it comes to domain management is choosing the right registrar.</span>
      <details>
      <summary>What to look for in a domain registrar</summary>
      <ul class="pl-4">
        <li><strong>Pricing:</strong> Compare registration, renewal, and transfer costs.</li>
        <li><strong>WHOIS Privacy:</strong> Check if privacy protection is free or paid.</li>
        <li><strong>Security Features:</strong> Look for 2FA, domain locking, and DNSSEC support.</li>
        <li><strong>Customer Support:</strong> Ensure 24/7 availability and helpfulness.</li>
        <li><strong>Longevity:</strong> Choose a well-established, reputable registrar.</li>
        <li><strong>Transparency:</strong> Avoid hidden fees or deceptive upselling.</li>
        <li><strong>Transfer Policies:</strong> Check ease and cost of transferring domains.</li>
        <li><strong>Lock-ins:</strong> Ensure no restrictive contracts or barriers to leaving.</li>
        <li><strong>User Interface:</strong> Opt for an intuitive and user-friendly dashboard.</li>
        <li><strong>Additional Services:</strong> Assess value of hosting, email, and SSL options.</li>
        <li><strong>TLD Availability:</strong> Confirm availability of desired domain extensions.</li>
        <li><strong>Reputation:</strong> Read reviews and ratings from other customers.</li>
      </ul>
      </details>
    `,
    links: registrars,
  },
  {
    title: 'Domain Management Platforms',
    description: `At Domain Locker, we don't lock you in. Managing your domains effectively is important,
    and we want you to land on the best platform for your needs.
    We've listed a detailed comparison of alternative domain management tools on
    our <a href="/about/alternatives">Comparison</a> page.
    But in short, below are the top domain management tools`,
    links: domainManagementPlatforms,
  },
  {
    title: 'SSL Certificate Providers',
    description: '',
    links: sslCerts,
  },
  {
    title: 'Open Source Utilities',
    description: ``,
    links: openSourceUtils,
  },
  {
    title: 'AS93 Apps',
    description: `If you've enjoyed Domain Locker, you might be interested in
    checking out some of the other apps I've developed. I'm active on GitHub at
    <a href="https://github.com/lissy93">@Lissy93</a>, and my full catalog of 50+ apps
    is available at <a href="https://as93.net">as93.net</a>.`,
    links: as93Apps,
  },
];
