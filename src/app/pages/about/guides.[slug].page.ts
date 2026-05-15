import { injectContent, injectContentFiles } from '@analogjs/content';

import { Component } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';
import {
  DocsViewerComponent,
  DocAttributes,
} from '~/app/components/about-things/doc-viewer.component';

@Component({
  standalone: true,
  selector: 'app-about-guides-slug-page',
  imports: [PrimeNgModule, DocsViewerComponent],
  template: `<app-docs-viewer
    [doc$]="doc$"
    [allDocs]="files"
    [categoryName]="category"
  />`,
})
export default class DocsComponent {
  // The subdirectory for the docs
  public category = 'guides';
  // Fetch the current *.md file and attributes
  readonly doc$ = injectContent<DocAttributes>({
    param: 'slug',
    subdirectory: `docs/${this.category}`,
  });
  // Fetch all the files in the same subdirectory
  readonly files = injectContentFiles<DocAttributes>((contentFile) =>
    contentFile.filename.includes(`/${this.category}/`),
  );
}
