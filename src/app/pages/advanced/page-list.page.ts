// page-list.page.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';

interface PageRoute {
  path: string;
  link?: string;
  name: string;
  isPublic: boolean;
  children?: PageRoute[];
}

@Component({
  selector: 'app-advanced-page-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PrimeNgModule],
  templateUrl: './page-list.page.html',
})
export default class PageListComponent implements OnInit {
  private http = inject(HttpClient);

  // discover all *.page.ts files at build time, eager, filter self out
  rawRoutes = Object.keys(
    import.meta.glob('/src/app/pages/**/*.page.ts', { eager: true }),
  ).filter((path) => !path.includes('page-list'));

  routeTree: PageRoute[] = [];

  ngOnInit() {
    // 1) build initial tree from file system
    this.routeTree = this.buildRouteTree(this.rawRoutes);

    // 2) fetch sitemap.xml, parse & merge any new public URLs
    this.http
      .get('https://domain-locker.com/sitemap.xml', { responseType: 'text' })
      .subscribe((xml) => {
        const urls = this.parseSitemap(xml);
        this.mergeSitemapUrls(urls);
      });
  }

  private parseSitemap(xml: string): string[] {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const locTags = Array.from(doc.getElementsByTagName('loc'));
    const paths = locTags
      .map((el) => el.textContent?.trim() || '')
      .filter((u) => !!u)
      .map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return u;
        }
      });
    return Array.from(new Set(paths));
  }

  private mergeSitemapUrls(urls: string[]) {
    const existing = new Set<string>();
    const collect = (nodes: PageRoute[]) => {
      for (const n of nodes) {
        if (n.link) existing.add(n.link);
        if (n.children) collect(n.children);
      }
    };
    collect(this.routeTree);

    urls.forEach((link) => {
      if (!existing.has(link)) {
        const rawName = link === '/' ? 'home' : link.split('/').pop() || '';
        const name = this.formatName(rawName, link === '/' ? 'Home' : undefined);
        const page: PageRoute = {
          path: `sitemap:${link}`,
          link,
          name,
          isPublic: true,
        };
        const parts = link.replace(/^\//, '').split('/').filter(Boolean);
        this.insertIntoTree(this.routeTree, parts, page);
      }
    });
  }

  private buildRouteTree(rawRoutes: string[]): PageRoute[] {
    const tree: PageRoute[] = [];

    rawRoutes.forEach((route) => {
      let rel = route.replace('src/app/pages/', '');
      rel = rel.replace(/^\([^/]+\)\//, '');
      rel = rel.replace(/^\([^/]+\)\.page\.ts$/, '');
      let routePath = rel.replace('.page.ts', '');
      if (routePath.endsWith('/index')) {
        routePath = routePath.replace(/\/index$/, '');
      }
      // home
      if (routePath === '') {
        routePath = '';
      }
      const link = routePath.includes('[') ? undefined : '/' + routePath;
      const segments = routePath.split('/').filter(Boolean);
      let rawName = segments.length ? segments.pop()! : 'home';
      rawName = rawName.replace(/^\.\.\./, '');
      const name = this.formatName(rawName, routePath === '' ? 'Home' : undefined);
      let isPublic = false;
      if (
        link === '/' ||
        link === '/login' ||
        (link && (link.startsWith('/about') || link.startsWith('/advanced')))
      ) {
        isPublic = true;
      }
      const page: PageRoute = { path: route, link, name, isPublic };
      this.insertIntoTree(tree, routePath.split('/').filter(Boolean), page);
    });

    return tree;
  }

  private insertIntoTree(tree: PageRoute[], parts: string[], page: PageRoute) {
    if (parts.length === 0) {
      tree.push(page);
      return;
    }
    const part = parts[0];
    let node = tree.find(
      (n) => n.name.toLowerCase() === this.formatName(part).toLowerCase(),
    );
    if (!node) {
      node = {
        path: '',
        name: this.formatName(part),
        isPublic: page.isPublic,
        children: [],
      };
      tree.push(node);
    }
    if (parts.length === 1) {
      Object.assign(node, page);
    } else {
      node.children = node.children || [];
      this.insertIntoTree(node.children, parts.slice(1), page);
    }
  }

  private formatName(name: string, override?: string): string {
    if (override) {
      return override;
    }
    return name
      .replace(/[[\]/]/g, '')
      .split(/[.\-_]/)
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
}
