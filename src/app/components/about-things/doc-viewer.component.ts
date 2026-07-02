import {
  Component,
  Input,
  HostListener,
  ViewChild,
  ElementRef,
  ViewEncapsulation,
  PLATFORM_ID,
  inject,
  OnInit,
  OnDestroy,
  AfterViewInit,
  AfterViewChecked,
} from '@angular/core';
import { ContentFile } from '@analogjs/content';
import { filter, Observable, Subscription } from 'rxjs';
import { MarkdownComponent } from '@analogjs/content';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { MetaTagsService } from '~/app/services/meta-tags.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

export interface DocAttributes {
  title: string;
  slug: string;
  description: string;
  coverImage?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  category?: string;
  noShowInContents?: boolean;
  index?: number;
}

@Component({
  standalone: true,
  selector: 'app-docs-viewer',
  imports: [CommonModule, MarkdownComponent, PrimeNgModule],
  template: `
    <section
      #docSection
      class="flex flex-row-reverse items-start gap-4 h-full mx-auto my-4 flex-wrap md:flex-nowrap min-h-[105vh]"
    >
      @if (doc) {
        <article class="p-card p-4 flex-1 h-full min-h-64 max-w-[60rem] w-2">
          <h2 class="text-3xl text-default opacity-100">{{ doc.attributes.title }}</h2>
          <analog-markdown
            class="block max-w-[59rem]"
            [content]="doc.content"
          ></analog-markdown>
        </article>
      }

      <div class="relative h-full min-h-64 min-w-[18rem] w-full md:w-fit mr-0 md:mr-4">
        <nav
          class="p-card py-4 relative md:fixed sticky-nav overflow-y-auto"
          [style.top]="navTop"
          [style.max-height]="navBottom"
        >
          <a [routerLink]="['/about', categoryName]" class="no-underline text-default">
            <h2 class="capitalize mx-4">{{ categoryName }} Docs</h2>
          </a>
          <ul class="list-none p-0 mx-0 mt-4 flex flex-col">
            @for (file of sortedDocs; track file; let index = $index) {
              <li
                class="border-x-0 border-b-0 border-t-2 border-solid border-surface-200"
              >
                @if (!file.attributes.noShowInContents) {
                  <a
                    [routerLink]="['/about', categoryName, file.slug]"
                    pTooltip="{{ file.attributes.description }}"
                    showDelay="300"
                    class="no-underline py-2 block px-4 hover:bg-surface-100 transition-all duration-200"
                    [ngClass]="{
                      'text-default font-bold': file.slug === doc?.slug,
                      'text-primary': file.slug !== doc?.slug,
                    }"
                  >
                    <span class="opacity-70 text-default font-normal"
                      >{{ index + 1 }}.
                    </span>
                    {{ file.attributes.title }}
                  </a>
                }
              </li>
            }
          </ul>
          <a routerLink="/about" class="w-full flex">
            <p-button
              label="All Docs"
              class="mx-auto no-underline"
              severity="secondary"
              [outlined]="true"
              size="small"
              icon="pi pi-arrow-left"
            />
          </a>
        </nav>
      </div>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['../../styles/prism.css'],
  styles: [
    `
      h2 {
        opacity: 70%;
      }
      h3 {
        opacity: 90%;
        margin-top: 1rem !important;
      }
      hr {
        border-color: var(--surface-50);
        margin-bottom: 2rem;
      }
      a:visited {
        color: var(--primary-color);
      }
      pre {
        overflow-x: scroll !important;
      }
      img {
        border-radius: 4px;
        display: flex;
        margin: 0 auto;
        max-width: 100%;
      }
      .sticky-nav {
        transition: top 0.3s ease;
      }
      table {
        width: 100%;
        border: 1px solid var(--surface-200);
        border-radius: 0.75rem;
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        font-size: 0.875rem;
      }
      thead {
        background-color: var(--surface-100);
        color: var(--surface-700);
      }
      thead tr th {
        padding: 0.75rem;
        text-align: left;
        font-weight: 600;
        border-bottom: 1px solid var(--surface-200);
      }
      tbody tr {
        background-color: var(--surface-0);
      }
      tbody tr:nth-child(even) {
        background-color: var(--surface-50);
      }
      tbody td {
        padding: 0.75rem;
        border-bottom: 1px solid var(--surface-200);
        overflow-wrap: anywhere;
      }
      .markdown-alert.markdown-alert-note {
        background-color: var(--yellow-200);
        color: var(--yellow-800);
        border: 1px solid var(--yellow-600);
        border-radius: 0.25rem;
        padding: 0.5rem;
        margin: 0.25rem 0 1rem 0;
        font-size: 0.8rem;
        line-height: 1rem;
        p {
          margin: 0.2rem 0 0 0;
          display: block;
          &::first-line {
            color: var(--yellow-400);
          }
        }
      }
      .info {
        background-color: var(--blue-200);
        color: var(--blue-800);
        border: 1px solid var(--blue-600);
        border-radius: 0.25rem;
        padding: 0.5rem;
        margin: 0.25rem 0 1rem 0;
        font-size: 0.8rem;
        line-height: 1rem;
        p {
          margin: 0.2rem 0 0 0;
        }
        a {
          color: var(--blue-800);
          text-decoration: underline;
        }
      }
    `,
  ],
})
export class DocsViewerComponent
  implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked
{
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);
  private metaTagsService = inject(MetaTagsService);
  private platformId = inject<object>(PLATFORM_ID);

  /** The doc$ to display. If it's null or never resolves, we'll treat it as 'not found'. */
  @Input() doc$!: Observable<ContentFile<DocAttributes | Record<string, never>>>;

  /** The array of docs for the same category, used for listing. */
  @Input() allDocs: ContentFile<DocAttributes>[] = [];

  /** The name of the category (e.g. 'legal', 'blog'), for building links. */
  @Input() categoryName = '';

  doc: ContentFile<DocAttributes | Record<string, never>> | null = null;

  navTop = 'unset';
  navBottom = 'unset';
  @ViewChild('docSection') private docSection?: ElementRef<HTMLElement>;
  private docSub?: Subscription;
  private routerSub?: Subscription;
  private docLoaded = false;
  private hasRenderedMermaid = false;

  ngOnInit() {
    this.docSub = this.doc$.subscribe({
      next: (doc) => {
        // Set current doc when it resolves
        this.doc = doc;
        // If doc has attributes, then get them for meta and JSON-LD content
        if (doc?.attributes) {
          const {
            title,
            description,
            coverImage,
            author,
            publishedDate,
            modifiedDate,
            slug,
          } = doc.attributes;

          // Set meta tags
          this.metaTagsService.setCustomMeta(
            title,
            description,
            undefined,
            coverImage || this.getFallbackImage(title),
          );

          // Set JSON-LD structured data
          this.metaTagsService.addStructuredData('article', {
            title: title,
            description: description,
            coverImage: coverImage || this.getFallbackImage(title),
            author: author || 'Domain Locker Team',
            publishedDate: publishedDate || new Date().toISOString(),
            modifiedDate: modifiedDate || publishedDate || new Date().toISOString(),
            slug: slug,
            category: this.categoryName,
          });
        }
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            this.loadAndRenderMermaid();
          }, 50);
        }
        this.docLoaded = true;
      },
      error: (err) => {
        this.errorHandler.handleError({
          error: err,
          message: 'Doc subscription error',
          location: 'doc-viewer',
        });
      },
    });

    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe({
        next: () => {
          if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => this.loadAndRenderMermaid(), 50);
          }
        },
        error: (err) => {
          this.errorHandler.handleError({
            error: err,
            message: 'Router events error',
            location: 'doc-viewer',
          });
        },
      });
  }

  ngOnDestroy(): void {
    if (this.docSub) {
      try {
        this.docSub.unsubscribe();
      } catch (err) {
        this.errorHandler.handleError({
          error: err,
          message: 'Doc subscription cleanup error',
          location: 'doc-viewer',
        });
      }
    }
    if (this.routerSub) {
      try {
        this.routerSub.unsubscribe();
      } catch (err) {
        this.errorHandler.handleError({
          error: err,
          message: 'Router subscription cleanup error',
          location: 'doc-viewer',
        });
      }
    }
  }

  ngAfterViewInit(): void {
    // Defer so the initial cap doesn't mutate bound styles mid-check
    if (isPlatformBrowser(this.platformId)) setTimeout(() => this.updateNav());
  }

  ngAfterViewChecked(): void {
    // If running client-side, and doc is loaded but no mermaid rendered yet, then init
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.docLoaded && !this.hasRenderedMermaid) {
      this.loadAndRenderMermaid();
      this.hasRenderedMermaid = true;
    }
  }

  public get sortedDocs(): ContentFile<DocAttributes>[] {
    return [...this.allDocs].sort((a, b) => {
      const aIndex =
        typeof a.attributes.index === 'number' ? a.attributes.index : Infinity;
      const bIndex =
        typeof b.attributes.index === 'number' ? b.attributes.index : Infinity;

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      } else {
        return a.attributes.title.localeCompare(b.attributes.title);
      }
    });
  }

  /** Pin nav near the top, and cap its height so it never overlaps the sponsor */
  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateNav() {
    try {
      const scrolledPastHeader = window.scrollY > 112; // ~7rem at 16px root
      const navTopPx = scrolledPastHeader ? 16 : 144; // matches navTop (1rem / 9rem)
      this.navTop = scrolledPastHeader ? '1rem' : '9rem';

      // Nav is only fixed at md+, so cap its height there to clear the sponsor below
      const section = this.docSection?.nativeElement;
      if (section && window.innerWidth >= 768) {
        const available = section.getBoundingClientRect().bottom - navTopPx;
        this.navBottom = `${Math.max(available, 0)}px`;
      } else {
        this.navBottom = 'unset';
      }
    } catch (err) {
      this.errorHandler.handleError({
        error: err,
        message: 'Scroll handler error',
        location: 'doc-viewer',
      });
    }
  }

  getFallbackImage(title: string) {
    try {
      const encodedTitle = encodeURIComponent(title);
      return (
        `https://dynamic-og-image-generator.vercel.app/api/generate?title=${encodedTitle}` +
        ' &author=Domain+Locker&websiteUrl=domain-locker.com&avatar=https%3A%2F%2Fdomain-locker' +
        '.com%2Ficons%2Fandroid-chrome-maskable-192x192.png&theme=dracula'
      );
    } catch (err) {
      this.errorHandler.handleError({
        error: err,
        message: 'Fallback image error',
        location: 'doc-viewer',
      });
      return 'https://domain-locker.com/og.png';
    }
  }

  /**
   * 1) Checks for any <pre class="mermaid"> blocks
   * 2) If found, dynamically load mermaid from a CDN
   * 3) Then call mermaid.initialize + mermaid.run
   */
  private loadAndRenderMermaid() {
    try {
      const mermaidBlocks = document.querySelectorAll('pre.mermaid');
      if (!mermaidBlocks?.length) {
        return;
      }
      const existingScript = document.getElementById(
        'mermaidScript',
      ) as HTMLScriptElement | null;
      if (existingScript) {
        this.runMermaid();
      } else {
        const script = document.createElement('script');
        script.id = 'mermaidScript';
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        script.async = true;
        script.onload = () => {
          this.runMermaid();
        };
        document.head.appendChild(script);
      }
    } catch (err) {
      this.errorHandler.handleError({
        error: err,
        message: 'loadAndRenderMermaid error',
        location: 'doc-viewer',
      });
    }
  }

  private runMermaid() {
    try {
      const mermaid = (
        window as unknown as {
          mermaid?: {
            initialize: (opts: { startOnLoad: boolean }) => void;
            run: (opts: { querySelector: string }) => void;
          };
        }
      ).mermaid;
      if (!mermaid) return;
      try {
        mermaid.initialize({ startOnLoad: false });
        mermaid.run({ querySelector: 'pre.mermaid' });
      } catch (err) {
        this.errorHandler.handleError({
          error: err,
          message: 'Mermaid render failed',
          location: 'doc-viewer',
        });
      }
    } catch (err) {
      this.errorHandler.handleError({
        error: err,
        message: 'runMermaid error',
        location: 'doc-viewer',
      });
    }
  }
}
