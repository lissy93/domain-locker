import { AfterViewInit, Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { documentationLinks, type LinkItem } from '~/app/constants/admin-links';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  standalone: true,
  selector: 'app-about-attributions-page',
  imports: [PrimeNgModule, DomainFaviconComponent],
  template: `
    <h1>Attributions</h1>
    <p>
      The ongoing development of Domain Locker wouldn't be possible without these
      supporters.
    </p>

    <!-- Spinner while building links -->
    @if (loading) {
      <p-progressSpinner class="flex mx-auto my-4"></p-progressSpinner>
    }

    @if (!loading) {
      <div class="">
        @for (section of sections; track section) {
          <div class="my-4 p-card p-3 pb-5">
            <h2 class="mb-3 text-{{ section.badge.color || 'primary' }}-400">
              {{ section.label }}
            </h2>
            <!-- Fallback image if iframe fails -->
            @if (section.showFallback) {
              <img [src]="section.url" alt="{{ section.label }}" class="mx-auto my-2" />
            }
            <!-- Iframe otherwise -->
            @if (!section.showFallback) {
              <iframe
                [src]="section.safeUrl"
                width="100%"
                [height]="frameHeight"
                frameborder="0"
                (error)="section.showFallback = true"
              ></iframe>
            }
            <p class="my-2 opacity-70 italic">
              Want to be included here?
              <a
                href="{{ section.badge.click }}"
                class="text-{{ section.badge.color || 'primary' }}-400 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ section.badge.text }}
              </a>
            </p>
            <!-- Badge -->
            @if (section.badge) {
              <a [href]="section.badge.click" target="_blank">
                <img [src]="section.badge.img" alt="{{ section.label }}" class="badge" />
              </a>
            }
          </div>
        }
        <div class="my-4 p-card p-3 pb-5">
          <h2 class="mb-3 text-purple-400">Dependencies</h2>
          <p class="my-2 opacity-70 italic">
            Building Domain Locker would not have been possible, without the amazing open
            source developers who build and maintain the dependencies we rely upon
          </p>
          <div>
            <ul
              class="list-none grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4"
            >
              @for (link of documentationLinks; track link) {
                <li class="flex items-start gap-2">
                  <app-domain-favicon
                    [domain]="link.url"
                    [size]="36"
                    class="mr-2 mt-2 w-[36px] h-[36px]"
                  />
                  <div class="flex flex-col">
                    <div class="flex gap-2 items-baseline">
                      <a [href]="link.url" target="_blank" rel="noopener noreferrer">
                        <h3 class="m-0">{{ link.provider }}</h3>
                      </a>
                      <span class="opacity-70 italic text-sm">{{ link.purpose }}</span>
                    </div>
                    @if (link.description) {
                      <span>{{ link.description }}</span>
                    }
                  </div>
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .badge {
        filter: invert(1) hue-rotate(45deg) saturate(5.5) opacity(0.5);
        float: right;
      }
    `,
  ],
})
export default class AttributionsPage implements AfterViewInit {
  private sanitizer = inject(DomSanitizer);
  private platformId = inject<object>(PLATFORM_ID);

  loading = true;

  user = 'lissy93';
  repo = 'domain-locker';
  frameHeight = 300;
  githubLink = `https://github.com/${this.user}/${this.repo}`;

  documentationLinks: LinkItem[] = documentationLinks;

  // Array of sections for contributors, sponsors, stargazers, forkers, etc.
  sections = [
    {
      label: 'Sponsors',
      type: 'sponsors',
      url: '',
      safeUrl: '',
      showFallback: false,
      badge: {
        img: `https://img.shields.io/github/sponsors/${this.user}?style=social&logo=github&label=Sponsor%20Us%3A%20Domain%20Locker`,
        click: `https://github.com/sponsors/${this.user}`,
        text: 'Sponsor us on GitHub',
        color: 'pink',
      },
    },
    {
      label: 'Contributors',
      type: 'contributors',
      url: '',
      safeUrl: '',
      showFallback: false,
      badge: {
        img: `https://img.shields.io/github/contributors/${this.user}/${this.repo}?style=social&logo=github&label=Contribute%3A%20Domain%20Locker`,
        click: this.githubLink,
        text: 'Contribute on GitHub',
        color: 'green',
      },
    },
    {
      label: 'Stargazers',
      type: 'stargazers',
      url: '',
      safeUrl: '',
      showFallback: false,
      badge: {
        img: `https://img.shields.io/github/stars/${this.user}/${this.repo}?style=social&label=Star%20Us%3A%20Domain%20Locker`,
        click: this.githubLink,
        text: 'Star us on GitHub',
        color: 'yellow',
      },
    },
    {
      label: 'Forkers',
      type: 'forkers',
      url: '',
      safeUrl: '',
      showFallback: false,
      badge: {
        img: `https://img.shields.io/github/forks/${this.user}/${this.repo}?style=social&label=Fork%20Us%3A%20Domain%20Locker`,
        click: this.githubLink,
        text: 'Fork us on GitHub',
        color: 'blue',
      },
    },
    // {
    //   label: 'Followers',
    //   type: 'followers',
    //   url: '',
    //   safeUrl: '',
    //   showFallback: false,
    //   badge: {
    //     img: `https://img.shields.io/github/followers/${this.user}?label=Followers%3A%20Lissy93`,
    //     click: `https://github.com/${this.user}`,
    //   },
    // },
  ];

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Build URLs for each section
      const bg = this.getColorVar('--surface-50', 'transparent').replace('#', '');
      const fg = this.getColorVar('--text-color', '#000').replace('#', '');

      // for each section
      this.sections.forEach((s) => {
        const builtUrl = this.buildUrl(s.type, bg, fg);
        s.url = builtUrl;
        s.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(builtUrl) as string;
      });
    }
    this.loading = false;
  }

  private buildUrl(type: string, bg: string, fg: string): string {
    const endpoint = 'https://readme-contribs.as93.net';
    const shape = 'circle';
    const size = 64;
    const theRepo = type === 'sponsors' ? '' : `/${this.repo}`;
    return (
      `${endpoint}/${type}/${this.user}${theRepo}?` +
      `avatarSize=${size}&shape=${shape}&perRow=12&` +
      `textColor=${encodeURIComponent(fg)}&backgroundColor=${encodeURIComponent(bg)}`
    );
  }

  private getColorVar(variable: string, fallback: string): string {
    try {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
      if (!val) throw new Error();
      if (val.startsWith('#')) return val;
      const rgb = val.match(/\d+/g)?.map(Number);
      return rgb
        ? `#${rgb
            .slice(0, 3)
            .map((c) => c.toString(16).padStart(2, '0'))
            .join('')}`
        : fallback;
    } catch {
      return fallback;
    }
  }
}
