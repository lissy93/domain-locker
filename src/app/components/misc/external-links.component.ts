import { Component, Input } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  standalone: true,
  selector: 'app-additional-resources',
  imports: [PrimeNgModule],
  template: `
    <p class="text-lg text-surface-500 italic mt-0 mb-4">
      The following free online tools can give you greater insight into your domain and
      website.
    </p>
    <ul class="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-0">
      @for (resource of resourcesToShow; track resource) {
        <li class="flex flex-col justify-between border-2 border-surface-100 rounded">
          <a
            [href]="makeLink(resource, url)"
            target="_blank"
            class="flex flex-col gap-2 no-underline p-2 transition-all"
          >
            <div class="flex items-center gap-2">
              <img [src]="resource.icon" alt="" class="w-[2rem] h-8 rounded-md" />
              <p class="text-base font-semibold flex-1 m-0">{{ resource.title }}</p>
            </div>
            <p class="text-sm text-surface-400 m-0">{{ resource.description }}</p>
          </a>
          <a
            [href]="resource.link"
            target="_blank"
            class="text-sm text-primary hover:underline mt-0 mb-2 mx-2"
            title="Open {{ resource.link }}"
          >
            {{ extractHostname(resource.link) }}
          </a>
        </li>
      }
    </ul>

    <p-divider align="center" (click)="toggleResourceShowFull()">
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

    <small class="text-xs mt-4 block text-gray-500">
      These tools are not affiliated with Domain Locker. Please use them at your own risk.
      If any tools are unavailable or become paid, please report it via
      <a
        href="https://github.com/lissy93/domain-locker"
        target="_blank"
        class="text-gray-500 hover:underline"
      >
        GitHub (lissy93/domain-locker) </a
      >.
    </small>
  `,
  styles: [``],
})
export class AdditionalResourcesComponent {
  @Input() url?: string;
  resources = [
    {
      title: 'SSL Labs Test',
      link: 'https://ssllabs.com/ssltest/analyze.html',
      icon: 'https://i.ibb.co/6bVL8JK/Qualys-ssl-labs.png',
      description: 'Analyzes the SSL configuration of a server and grades it',
      searchLink: 'https://www.ssllabs.com/ssltest/analyze.html?d={URL}',
    },
    {
      title: 'Virus Total',
      link: 'https://virustotal.com',
      icon: 'https://i.ibb.co/dWFz0RC/Virustotal.png',
      description: 'Checks a URL against multiple antivirus engines',
      searchLink: 'https://www.virustotal.com/gui/search/{URL_ENCODED}',
    },
    {
      title: 'Shodan',
      link: 'https://shodan.io/',
      icon: 'https://i.ibb.co/SBZ8WG4/shodan.png',
      description: 'Search engine for Internet-connected devices',
      searchLink: 'https://www.shodan.io/search/report?query={URL}',
    },
    {
      title: 'Page Speed Insights',
      link: 'https://developers.google.com/speed/pagespeed/insights/',
      icon: 'https://i.ibb.co/k68t9bb/Page-speed-insights.png',
      description:
        'Checks the performance, accessibility and SEO of a page on mobile + desktop',
      searchLink: 'https://developers.google.com/speed/pagespeed/insights/?url={URL}',
    },
    {
      title: 'Web Check',
      link: 'https://web-check.xyz',
      icon: 'https://i.ibb.co/q1gZN2p/web-check-logo.png',
      description: 'View literally everything about a website',
      searchLink: 'https://web-check.xyz/check/{URL}',
    },
    {
      title: 'Archive',
      link: 'https://archive.org/',
      icon: 'https://i.ibb.co/nfKMvCm/Archive-org.png',
      description: 'View previous versions of a site via the Internet Archive',
      searchLink: 'https://web.archive.org/web/*/{URL}',
    },
    {
      title: 'URLScan',
      link: 'https://urlscan.io/',
      icon: 'https://i.ibb.co/cYXt8SH/Url-scan.png',
      description: 'Scans a URL and provides information about the page',
      searchLink: 'https://urlscan.io/search/#{URL}',
    },
    {
      title: 'Sucuri SiteCheck',
      link: 'https://sitecheck.sucuri.net/',
      icon: 'https://i.ibb.co/K5pTP1K/Sucuri-site-check.png',
      description: 'Checks a URL against blacklists and known threats',
      searchLink: 'https://www.ssllabs.com/ssltest/analyze.html?d={URL}',
    },
    {
      title: 'Domain Tools',
      link: 'https://whois.domaintools.com/',
      icon: 'https://i.ibb.co/zJfCKjM/Domain-tools.png',
      description: 'Run a WhoIs lookup on a domain',
      searchLink: 'https://whois.domaintools.com/{DOMAIN}',
    },
    {
      title: 'NS Lookup',
      link: 'https://nslookup.io/',
      icon: 'https://i.ibb.co/BLSWvBv/Ns-lookup.png',
      description: 'View DNS records for a domain',
      searchLink: 'https://www.nslookup.io/domains/{DOMAIN}/dns-records/',
    },
    {
      title: 'DNS Checker',
      link: 'https://dnschecker.org/',
      icon: 'https://i.ibb.co/gyKtgZ1/Dns-checker.webp',
      description: 'Check global DNS propagation across multiple servers',
      searchLink: 'https://dnschecker.org/#A/{DOMAIN}',
    },
    {
      title: 'Censys',
      link: 'https://search.censys.io/',
      icon: 'https://i.ibb.co/j3ZtXzM/censys.png',
      description: 'Lookup hosts associated with a domain',
      searchLink: 'https://search.censys.io/search?resource=hosts&q={URL}',
    },
    {
      title: 'Built With',
      link: 'https://builtwith.com/',
      icon: 'https://i.ibb.co/5LXBDfD/Built-with.png',
      description: 'View the tech stack of a website',
      searchLink: 'https://builtwith.com/{URL}',
    },
    {
      title: 'DNS Dumpster',
      link: 'https://dnsdumpster.com/',
      icon: 'https://i.ibb.co/DtQ2QXP/Trash-can-regular.png',
      description: "DNS recon tool, to map out a domain from it's DNS records",
    },
    {
      title: 'BGP Tools',
      link: 'https://bgp.tools/',
      icon: 'https://i.ibb.co/zhcSnmh/Bgp-tools.png',
      description: 'View realtime BGP data for any ASN, Prefix or DNS',
      searchLink: 'https://bgp.tools/dns/{URL}',
    },
    {
      title: 'Similar Web',
      link: 'https://similarweb.com/',
      icon: 'https://i.ibb.co/9YX8x3c/Similar-web.png',
      description: 'View approx traffic and engagement stats for a website',
      searchLink: 'https://similarweb.com/website/{URL}',
    },
    {
      title: 'Blacklist Checker',
      link: 'https://blacklistchecker.com/',
      icon: 'https://i.ibb.co/7ygCyz3/black-list-checker.png',
      description: 'Check if a domain, IP or email is present on the top blacklists',
      searchLink: 'https://blacklistchecker.com/check?input={URL}',
    },
    {
      title: 'Cloudflare Radar',
      link: 'https://radar.cloudflare.com/',
      icon: 'https://i.ibb.co/DGZXRgh/Cloudflare.png',
      description: 'View traffic source locations for a domain through Cloudflare',
      searchLink: 'https://radar.cloudflare.com/domains/domain/{URL}',
    },
    {
      title: 'Mozilla HTTP Observatory',
      link: 'https://developer.mozilla.org/en-US/observatory',
      icon: 'https://i.ibb.co/hBWh9cj/logo-mozm-5e95c457fdd1.png',
      description:
        'Assesses website security posture by analyzing various security headers and practices',
      searchLink: 'https://developer.mozilla.org/en-US/observatory/analyze?host={URL}',
    },
    {
      title: 'AbuseIPDB',
      link: 'https://abuseipdb.com/',
      icon: 'https://i.ibb.co/KLZncxw/abuseipdb.png',
      description: "Checks a website against Zscaler's dynamic risk scoring engine",
      searchLink: 'https://www.abuseipdb.com/check?query={DOMAIN}',
    },
    {
      title: 'IBM X-Force Exchange',
      link: 'https://exchange.xforce.ibmcloud.com/',
      icon: 'https://i.ibb.co/tsTsCV5/x-force.png',
      description: 'View shared human and machine generated threat intelligence',
      searchLink: 'https://exchange.xforce.ibmcloud.com/url/{URL_ENCODED}',
    },
    {
      title: 'URLVoid',
      link: 'https://urlvoid.com/',
      icon: 'https://i.ibb.co/0ZDjCDz/urlvoid-icon.png',
      description:
        'Checks a website across 30+ blocklist engines and website reputation services',
      searchLink: 'https://urlvoid.com/scan/{DOMAIN}',
    },
    {
      title: 'ANY.RUN',
      link: 'https://any.run/',
      icon: 'https://i.ibb.co/6nLw2MC/anyrun-icon.png',
      description: 'An interactive malware and web sandbox',
    },
    {
      title: 'Hudson Rock',
      link: 'https://hudsonrock.com/free-tools/?=webcheck',
      icon: 'https://i.ibb.co/0rF3rZh/logo-1-967abb2c.png',
      description: 'Identify Infostealer infection data related to domains and emails',
    },
  ];

  resourceShortList = [
    this.resources[0],
    this.resources[1],
    this.resources[2],
    this.resources[3],
  ];

  showFullList = false;
  resourcesToShow = this.resourceShortList;

  makeLink(
    resource: { link: string; searchLink?: string },
    scanUrl: string | undefined,
  ): string {
    if (!scanUrl || !resource.searchLink) {
      return resource.link;
    }

    const formattedUrl = scanUrl.replace(/(https?:\/\/)?/i, '');
    return resource.searchLink
      .replaceAll('{URL}', formattedUrl)
      .replaceAll('{URL_ENCODED}', encodeURIComponent(formattedUrl))
      .replaceAll('{DOMAIN}', formattedUrl.replace(/(www\.)?/i, '').replace(/\/.*/, ''));
  }

  extractHostname(url: string): string {
    return new URL(url).hostname;
  }

  toggleResourceShowFull(): void {
    if (this.showFullList) {
      this.resourcesToShow = this.resourceShortList;
      this.showFullList = false;
    } else {
      this.resourcesToShow = this.resources;
      this.showFullList = true;
    }
  }
}
