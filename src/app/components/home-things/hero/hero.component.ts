import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterModule, PrimeNgModule, TranslateModule],
  templateUrl: './hero.component.html',
  styles: [],
})
export class HeroComponent {
  features = [
    { icon: 'pi-lock', text: 'HOME.HERO.FEATURES.TRACK_DOMAINS' },
    { icon: 'pi-sparkles', text: 'HOME.HERO.FEATURES.DETAILED_METRICS' },
    { icon: 'pi-send', text: 'HOME.HERO.FEATURES.ALERTS' },
    { icon: 'pi-wave-pulse', text: 'HOME.HERO.FEATURES.MONITORING' },
    { icon: 'pi-check', text: 'HOME.HERO.FEATURES.MORE' },
  ];
}
