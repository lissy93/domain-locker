import { Component, Input, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LogoComponent } from '~/app/components/home-things/logo/logo.component';

declare const __APP_VERSION__: string;

interface FooterCta {
  label: string;
  link?: string;
  href?: string;
  queryParams?: Record<string, string>;
  click?: () => void;
  icon?: string;
  isPrimary?: boolean;
}

interface FooterLink {
  label: string;
  link?: string;
  href?: string;
}

interface FooterContent {
  name: string;
  description: string;
  ctas: FooterCta[];
  left: FooterLink[];
  middle: FooterLink[];
  right: FooterLink[];
}

@Component({
  standalone: true,
  selector: 'app-footer',
  imports: [PrimeNgModule, LogoComponent],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  styles: [],
})
export class FooterComponent {
  private router = inject(Router);
  private translate = inject(TranslateService);

  @Input() public big = false;
  public year: number = new Date().getFullYear();
  public appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  public fc: FooterContent = {
    name: '',
    description: '',
    ctas: [],
    left: [],
    middle: [],
    right: [],
  };

  constructor() {
    this.translate
      .get([
        'FOOTER.NAME',
        'FOOTER.DESCRIPTION',
        'FOOTER.CTAS.SIGN_UP',
        'FOOTER.CTAS.GET_CODE',
        'FOOTER.LINKS.LEFT.FEATURES',
        'FOOTER.LINKS.LEFT.PRICING',
        'FOOTER.LINKS.LEFT.SELF_HOSTING',
        'FOOTER.LINKS.LEFT.ALTERNATIVES',
        'FOOTER.LINKS.MIDDLE.STATUS',
        'FOOTER.LINKS.MIDDLE.MORE_APPS',
        'FOOTER.LINKS.MIDDLE.SUPPORT',
        'FOOTER.LINKS.MIDDLE.ATTRIBUTIONS',
        'FOOTER.LINKS.RIGHT.LICENSE',
        'FOOTER.LINKS.RIGHT.SECURITY',
        'FOOTER.LINKS.RIGHT.PRIVACY_POLICY',
        'FOOTER.LINKS.RIGHT.TERMS_OF_SERVICE',
      ])
      .subscribe((translations) => {
        this.fc = {
          name: translations['FOOTER.NAME'],
          description: translations['FOOTER.DESCRIPTION'],
          ctas: [
            {
              label: translations['FOOTER.CTAS.SIGN_UP'],
              link: '/login',
              queryParams: { newUser: 'true' },
              icon: 'pi pi-sparkles',
              isPrimary: true,
            },
            {
              label: translations['FOOTER.CTAS.GET_CODE'],
              click: () =>
                window.open('https://github.com/lissy93/domain-locker', '_blank'),
              icon: 'pi pi-github',
              isPrimary: false,
            },
          ],
          left: [
            {
              label: translations['FOOTER.LINKS.LEFT.FEATURES'],
              link: '/about/features',
            },
            { label: translations['FOOTER.LINKS.LEFT.PRICING'], link: '/about/pricing' },
            {
              label: translations['FOOTER.LINKS.LEFT.SELF_HOSTING'],
              link: '/about/self-hosting',
            },
            {
              label: translations['FOOTER.LINKS.LEFT.ALTERNATIVES'],
              link: '/about/alternatives',
            },
          ],
          middle: [
            {
              label: translations['FOOTER.LINKS.MIDDLE.STATUS'],
              link: '/advanced/status',
            },
            {
              label: translations['FOOTER.LINKS.MIDDLE.SUPPORT'],
              link: '/about/support',
            },
            {
              label: translations['FOOTER.LINKS.MIDDLE.ATTRIBUTIONS'],
              link: '/about/attributions',
            },
            {
              label: translations['FOOTER.LINKS.MIDDLE.MORE_APPS'],
              href: 'https://as93.net',
            },
          ],
          right: [
            {
              label: translations['FOOTER.LINKS.RIGHT.LICENSE'],
              link: '/about/legal/license',
            },
            {
              label: translations['FOOTER.LINKS.RIGHT.SECURITY'],
              link: '/about/legal/security',
            },
            {
              label: translations['FOOTER.LINKS.RIGHT.PRIVACY_POLICY'],
              link: '/about/legal/privacy-policy',
            },
            {
              label: translations['FOOTER.LINKS.RIGHT.TERMS_OF_SERVICE'],
              link: '/about/legal/terms-of-service',
            },
          ],
        };
      });
  }
}
