import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { DemoComponent } from '~/app/components/home-things/demo/demo.component';
import { CtaComponent } from '~/app/components/home-things/cta/cta.component';
import { ScreenshotsComponent } from '~/app/components/home-things/screenshots/screenshots.component';
import { screenshots } from '~/app/pages/about/data/feature-comparison';

@Component({
  selector: 'app-about-demo-page',
  template: `
    <h1 class="my-4 text-2xl">Domain Locker Demos</h1>
    <app-demo [standAlone]="true" />
    <p-card styleClass="mt-4 mx-2 mb-0">
      <h3>About the Demo</h3>
      <p class="m-0">
        Try before you buy (or self-host). The live demo will give you an idea of what
        Domain Locker can do for you.
      </p>
      <p class="text-sm text-orange-400 my-2 opacity-80">
        Note that any data written to the demo database will be reset every 24 hours.
        <br />
        Some features on the live demo have been disabled for security reasons.
      </p>
    </p-card>
    <p-divider />
    <app-screenshots [screenshots]="screenshots" />
    <p-divider />
    <p-card styleClass="mx-2">
      <h3>Try it locally</h3>
      <pre>curl -fsSL https://install.domain-locker.com | bash</pre>
    </p-card>
    <p-divider />
    <app-cta />
  `,
  standalone: true,
  imports: [PrimeNgModule, DemoComponent, CtaComponent, ScreenshotsComponent],
})
export default class DemoPage {
  public screenshots = screenshots;
}
