import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

import { aboutPages } from '~/app/pages/about/data/about-page-list';
import { injectContentFiles, ContentFile } from '@analogjs/content';
import { DocAttributes } from '~/app/components/about-things/doc-viewer.component';
import { DlIconComponent } from '~/app/components/misc/svg-icon.component';
import { CtaComponent } from '~/app/components/home-things/cta/cta.component';

@Component({
  standalone: true,
  selector: 'app-about-page',
  templateUrl: './about.page.html',
  imports: [PrimeNgModule, DlIconComponent, CtaComponent],
})
export default class AboutPageComponent {
  sections = aboutPages;

  readonly autoLinks: Record<string, ContentFile<DocAttributes>[]> = {
    legal: this.createSortedContentFiles((contentFile) =>
      contentFile.filename.includes('/legal'),
    ),
    developing: this.createSortedContentFiles((contentFile) =>
      contentFile.filename.includes('/developing/'),
    ),
    'self-hosting': this.createSortedContentFiles((contentFile) =>
      contentFile.filename.includes('/self-hosting/'),
    ),
    articles: this.createSortedContentFiles((contentFile) =>
      contentFile.filename.includes('/articles/'),
    ),
    guides: this.createSortedContentFiles((contentFile) =>
      contentFile.filename.includes('/guides/'),
    ),
  };

  private sortDocs<T extends { attributes: { index?: number; title: string } }>(
    docs: T[],
  ): T[] {
    return [...docs].sort((a, b) => {
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

  private createSortedContentFiles(
    predicate: (contentFile: ContentFile<DocAttributes>) => boolean,
  ) {
    const files = injectContentFiles<DocAttributes>(predicate);
    return this.sortDocs(files);
  }

  makeId(title: string): string {
    return title.toLowerCase().replace(/ /g, '-');
  }
}
