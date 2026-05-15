import { Component, OnInit, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { MetaTagsService } from '~/app/services/meta-tags.service';
import { sections } from '../data/useful-links';

@Component({
  selector: 'app-about-external-tools-page',
  standalone: true,
  imports: [PrimeNgModule],
  templateUrl: './index.page.html',
})
export default class ExternalToolsPage implements OnInit {
  private metaTagsService = inject(MetaTagsService);

  public sections = sections;

  makeId(title: string) {
    return title.toLowerCase().replace(/\s/g, '-');
  }

  ngOnInit() {
    this.metaTagsService.setCustomMeta(
      'Domain Tools and Resources',
      'A directory of free, useful tools and resources for domain owners, including WHOIS lookups, DNS checks, SSL validation, and more.',
    );
  }
}
