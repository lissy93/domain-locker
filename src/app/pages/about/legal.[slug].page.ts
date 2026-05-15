import { injectContent, injectContentFiles } from '@analogjs/content';

import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';
import {
  DocsViewerComponent,
  DocAttributes,
} from '~/app/components/about-things/doc-viewer.component';

@Component({
  standalone: true,
  selector: 'app-about-legal-slug-page',
  imports: [PrimeNgModule, DocsViewerComponent],
  template: `<app-docs-viewer
    [doc$]="doc$"
    [allDocs]="files"
    [categoryName]="'legal'"
  />`,
})
export default class DocsComponent {
  // The subdirectory for the docs
  private category = 'legal';
  // Fetch the current *.md file and attributes
  readonly doc$ = injectContent<DocAttributes>({
    param: 'slug',
    subdirectory: `docs/${this.category}`,
  });
  // Fetch all the files in the same subdirectory
  readonly files = injectContentFiles<DocAttributes>((contentFile) =>
    contentFile.filename.includes(`/${this.category}`),
  );
}
