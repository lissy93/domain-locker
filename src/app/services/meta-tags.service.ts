import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class MetaTagsService {
  private title = inject(Title);
  private meta = inject(Meta);
  private document = inject<Document>(DOCUMENT);
  private platformId = inject<object>(PLATFORM_ID);

  // Defaults
  private defaultTitle = 'Domain Locker';
  private defaultDescription =
    'Domain Locker helps you track, monitor, and manage your domains effortlessly. ' +
    'Stay on top of expiration dates, DNS records, and changes with alerts and detailed insights.';
  private defaultKeywords =
    'domain management, domain monitoring, DNS records, change tracking, alerts, SSL, WHOIS, domain security, url alerts';

  // Local fields which can override defaults if set
  private pageTitle?: string;
  private pageDescription?: string;
  private pageKeywords?: string;
  private pageCoverImage?: string;
  private jsonLdSchemas = new Map<string, Record<string, unknown>>();

  public setRouteMeta(routeName: string) {
    // Set to defaults
    this.reset(false);
    const baseRoute = (routeName || '').split('/')[1];

    // If page has some pre-defined top-level meta tags, set them
    switch (baseRoute) {
      case 'about':
        this.pageTitle = 'Documentation & Helpful Resources';
        this.pageDescription =
          'Tips for managing your domains, getting the most out of Domain Locker, and helpful guides and articles';
        break;
      case 'login':
        this.pageTitle = 'Login';
        this.pageDescription =
          'Log in or sign up to Domain Locker - the all-in-one domain management tool.';
        break;
      case 'domains':
        this.pageTitle = 'Domains';
        break;
      case 'assets':
        this.pageTitle = 'Assets';
        break;
      case 'stats':
        this.pageTitle = 'Stats';
        break;
      case 'value':
        this.pageTitle = 'Valuation Tracking';
        break;
      case 'monitor':
        this.pageTitle = 'Website Monitor';
        break;
      case 'settings':
        this.pageTitle = 'Settings';
        break;
      default:
        break;
    }

    // If a specific route has custom meta tags, set them
    switch (routeName) {
      case '/settings/account':
        this.pageTitle = 'Account Settings';
        break;
    }
    // Apply meta tags
    this.applyTags();
  }

  /* Applies either default or custom meta tags */
  private applyTags() {
    const title = this.pageTitle
      ? `${this.pageTitle} | ${this.defaultTitle}`
      : this.defaultTitle;
    const description = this.pageDescription || this.defaultDescription;
    const keywords = this.pageKeywords || this.defaultKeywords;
    const ogImage = this.pageCoverImage || 'https://domain-locker.com/og.png';

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'keywords', content: keywords });
    this.meta.updateTag({ property: 'og:image', content: ogImage });
  }

  /** Reset to global defaults */
  public reset(apply = true) {
    this.pageTitle = undefined;
    this.pageDescription = undefined;
    this.pageKeywords = undefined;
    if (apply) {
      this.applyTags();
    }
  }

  /** Can be called within a page, to dynamically set meta tags */
  public setCustomMeta(
    customTitle?: string,
    customDesc?: string,
    customKeywords?: string,
    customOgImage?: string,
  ) {
    this.pageTitle = customTitle || this.defaultTitle;
    this.pageDescription = customDesc || this.defaultDescription;
    this.pageKeywords = customKeywords || this.defaultKeywords;
    this.pageCoverImage = customOgImage || 'https://domain-locker.com/og.png';

    this.applyTags();
  }

  /** Set the robots meta tag */
  public allowRobots(bots: boolean) {
    const content = bots ? 'index, follow' : 'noindex, nofollow';
    this.meta.updateTag({ name: 'robots', content });
  }

  private injectJsonLD() {
    if (isPlatformBrowser(this.platformId)) {
      this.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((el) => el.remove());
      this.jsonLdSchemas.forEach((schema) => {
        const script = this.document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        this.document.head.appendChild(script);
      });
    } else {
      this.meta.updateTag({
        property: 'structured-data',
        content: JSON.stringify([...this.jsonLdSchemas.values()]),
      });
    }
  }

  public addStructuredData(
    type: 'about' | 'faq' | 'breadcrumb' | 'software' | 'article',
    extraData?: Record<string, unknown> | unknown[],
  ) {
    let jsonLd: Record<string, unknown>;

    switch (type) {
      case 'about':
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'About Domain Locker',
          description:
            'Learn more about Domain Locker, the all-in-one domain management tool.',
          author: {
            '@type': 'Person',
            name: 'Alicia Sykes',
            url: 'https://aliciasykes.com',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Domain Locker',
            url: 'https://domain-locker.com',
          },
        };
        break;

      case 'faq':
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: extraData || [],
        };
        break;

      case 'breadcrumb':
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: extraData || [],
        };
        break;

      case 'article': {
        const article = (extraData as Record<string, unknown>) || {};
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article['title'] || 'Domain Locker Articles',
          description: article['description'] || 'No description available.',
          author: {
            '@type': 'Person',
            name: 'Alicia Sykes',
            url: 'https://aliciasykes.com',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Domain Locker',
            url: 'https://domain-locker.com',
            logo: { '@type': 'ImageObject', url: 'https://domain-locker.com/logo.png' },
          },
          image: article['coverImage'] || 'https://domain-locker.com/og.png',
          url: `https://domain-locker.com/about/${article['category'] || 'uncategorized'}/${article['slug'] || 'unknown'}`,
          datePublished: article['publishedDate'] || new Date().toISOString(),
          dateModified:
            article['modifiedDate'] ||
            article['publishedDate'] ||
            new Date().toISOString(),
        };
        break;
      }

      case 'software':
      default: {
        const software = (extraData as Record<string, unknown>) || {};
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Domain Locker',
          operatingSystem: 'All',
          applicationCategory: 'BusinessApplication',
          url: 'https://domain-locker.com',
          image: 'https://domain-locker.com/logo.png',
          description:
            'Domain Locker is a powerful tool to manage domains, track changes, and monitor expiration dates.',
          offers: software['offers'] || {
            '@type': 'Offer',
            price: '0.00',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: 4.9,
            ratingCount: 420,
          },
        };
        break;
      }
    }
    this.jsonLdSchemas.set(type, jsonLd);
    this.injectJsonLD();
  }
}
