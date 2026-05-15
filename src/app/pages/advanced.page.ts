import { Component, PLATFORM_ID, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FeatureService } from '../services/features.service';
import { MetaTagsService } from '~/app/services/meta-tags.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';

@Component({
  standalone: true,
  selector: 'app-advanced-layout-page',
  imports: [CommonModule, RouterOutlet, PrimeNgModule, FeatureNotEnabledComponent],
  template: `
    @if (enableAdvancedInfo$ | async) {
      @if (isBrowser) {
        <router-outlet></router-outlet>
      } @else {
        <div class="flex flex-col items-center justify-center mt-6">
          <h1 class="text-2xl">Advanced Settings</h1>
          <p class="mt-4">This page is only available in the browser.</p>
          <p class="mt-1">Please check your console for any errors.</p>
        </div>
      }
    } @else {
      <app-feature-not-enabled feature="enableAdvancedInfo" />
    }
  `,
})
export default class AdvancedIndexPage implements OnInit {
  private featureService = inject(FeatureService);
  private metaTagsService = inject(MetaTagsService);
  private platformId = inject<object>(PLATFORM_ID);

  isBrowser = isPlatformBrowser(this.platformId);
  enableAdvancedInfo$ = this.featureService.isFeatureEnabled('enableAdvancedInfo');

  ngOnInit() {
    this.metaTagsService.allowRobots(false);
    this.metaTagsService.setCustomMeta(
      'Advanced Developer Options',
      'Service status, error logs, debug info, diagnostic actions, ' +
        'admin links, db connectors and advanced settings.',
    );
  }
}
