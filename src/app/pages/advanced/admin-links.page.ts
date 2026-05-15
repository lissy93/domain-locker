import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';

import {
  selfHostedLinks,
  serviceLinks,
  documentationLinks,
  downloadLinks,
  type LinkItem,
} from '~/app/constants/admin-links';

@Component({
  standalone: true,
  selector: 'app-advanced-admin-links-page',
  imports: [PrimeNgModule, DomainFaviconComponent],
  templateUrl: './admin-links.page.html',
})
export default class AdminLinksPage {
  public sections: {
    title: string;
    id: string;
    description: string;
    links: LinkItem[];
  }[] = [
    {
      title: 'Third-Party Services',
      id: 'third-party',
      description:
        'These services are managed by third-party providers, and ' +
        'are used on the Domain-Locker.com managed instance.',
      links: serviceLinks,
    },
    {
      title: 'Downloads',
      id: 'download-sources',
      description: 'Registries hosting Domain Locker for various platforms and systems. ',
      links: downloadLinks,
    },
    {
      title: 'Documentation (for developers)',
      id: 'documentation',
      description:
        "If you're delving into the codebase, these are the links " +
        'for the docs of the technologies we use.',
      links: documentationLinks,
    },
    {
      title: 'Self-hosted Services',
      id: 'self-hosted',
      description:
        'These are the components of the self-hosted version of Domain Locker. ' +
        "There's no requirement for any third-party services.",
      links: selfHostedLinks,
    },
  ];

  public details = [
    'ℹ️ These are links to the admin panels of external and third-party services used by Domain Locker.',
    '⚠️ This content is intended only for system administrators and developers. ' +
      'Therefore these portals will be inaccessible to you, if you have not either ' +
      'been granted permissions to the Domain-Locker team, or set these services ' +
      'up on your own instance.',
    '❗ Domain Locker cannot guarantee the availability, reliability, or security ' +
      'of these external services. Use them at your own discretion.',
  ];
}
