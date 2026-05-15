import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-demo',
  template: `
    <div
      [ngClass]="standAlone ? 'flex flex-col' : 'flex flex-wrap md:flex-nowrap'"
      class="w-full px-2 h-full gap-4"
    >
      <!-- Demo link and credentials -->
      <div class="p-card flex-1 py-4 px-3">
        <h4>{{ 'HOME.DEMO.LIVE_DEMO_TITLE' | translate }}</h4>
        <p>
          {{ 'HOME.DEMO.LIVE_DEMO_DESC' | translate }}
          <a href="https://demo.domain-locker.com" class="text-primary">{{
            'HOME.DEMO.DEMO_DOMAIN' | translate
          }}</a
          >.
        </p>
        <h5>{{ 'HOME.DEMO.CREDENTIALS' | translate }}</h5>
        <ul class="m-0 pl-3">
          <li>{{ 'HOME.DEMO.USERNAME' | translate }}</li>
          <li>{{ 'HOME.DEMO.PASSWORD' | translate }}</li>
        </ul>
        <a href="https://demo.domain-locker.com">
          <p-button
            [label]="'HOME.DEMO.VISIT_DEMO' | translate"
            class="float-right"
            icon="pi pi-desktop"
          ></p-button>
        </a>
      </div>
      <!-- Demo video -->
      <div class="p-card flex-1 py-4 px-3 hidden">
        <h4>{{ 'HOME.DEMO.VIDEO_DEMO_TITLE' | translate }}</h4>
        <p>{{ 'HOME.DEMO.VIDEO_DEMO_DESC' | translate }}</p>
        <a href="#">
          <p-button
            [label]="'HOME.DEMO.WATCH_VIDEO' | translate"
            class="float-right"
            icon="pi pi-video"
          ></p-button>
        </a>
      </div>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, PrimeNgModule, TranslateModule],
})
export class DemoComponent {
  @Input() standAlone?: boolean = false;
}
