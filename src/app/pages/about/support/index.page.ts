import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { supportContent } from '~/app/pages/about/data/support-links';

@Component({
  standalone: true,
  selector: 'app-about-support-page',
  imports: [PrimeNgModule],
  templateUrl: './index.page.html',
  styles: [``],
})
export default class SelfHostedSupportPage {
  public content = supportContent;
  public hideTitle = false;
}
