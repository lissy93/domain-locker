import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  standalone: true,
  selector: 'app-about-support-feedback-page',
  imports: [PrimeNgModule],
  template: `
    <div style="position: relative; height:40dvh; overflow:auto;">
      <iframe
        src="https://app.formbricks.com/s/cm70l7z0s0000l103uiuf1y6m?embed=true"
        frameborder="0"
        style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;"
      >
      </iframe>
    </div>
  `,
  styles: [``],
})
export default class SupportPage {}
