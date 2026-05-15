import { Component } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { trigger, style, animate, transition, query, group } from '@angular/animations';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-welcome',
  imports: [PrimeNgModule, TranslateModule],
  templateUrl: './welcome.component.html',
  animations: [
    trigger('fadeInSequence', [
      transition(':enter', [
        group([
          query('.fade-in', [style({ opacity: 0 })], { optional: true }),

          // Title Animation
          query(
            '.fade-in-title',
            [
              style({ opacity: 0, transform: 'translateY(-50px)' }),
              animate(
                '1s 0.5s ease-out',
                style({ opacity: 1, transform: 'translateY(0)' }),
              ),
            ],
            { optional: true },
          ),

          // Features Animation
          query(
            '.fade-in-features',
            [
              style({ opacity: 0, transform: 'translateX(-100px)' }),
              animate(
                '1s 1.5s ease-out',
                style({ opacity: 1, transform: 'translateX(0)' }),
              ),
            ],
            { optional: true },
          ),

          // Getting Started Animation
          query(
            '.fade-in-start',
            [
              style({ opacity: 0, transform: 'translateX(-100px)' }),
              animate(
                '1s 2.5s ease-out',
                style({ opacity: 1, transform: 'translateX(0)' }),
              ),
            ],
            { optional: true },
          ),

          // Button Animation
          query(
            '.fade-in-button',
            [
              style({ opacity: 0, transform: 'translateY(50px)' }),
              animate(
                '0.5s 3.2s ease-out',
                style({ opacity: 1, transform: 'translateY(0)' }),
              ),
            ],
            { optional: true },
          ),

          // Tip Animation
          query(
            '.fade-in-tip',
            [
              style({ opacity: 0, transform: 'translateY(25px)' }),
              animate(
                '0.2s 4s ease-out',
                style({ opacity: 0.8, transform: 'translateY(0)' }),
              ),
            ],
            { optional: true },
          ),
        ]),
      ]),
    ]),
  ],
})
export class WelcomeComponent {}
