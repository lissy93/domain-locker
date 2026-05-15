import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { selfHostedSupport } from '~/app/pages/about/data/support-links';

@Component({
  standalone: true,
  selector: 'app-about-support-self-hosted-support-page',
  imports: [CommonModule, PrimeNgModule],
  templateUrl: './index.page.html',

  styles: [``],
})
export default class SelfHostedSupportPage {
  public content = [selfHostedSupport];
  public hideTitle = true;
}
