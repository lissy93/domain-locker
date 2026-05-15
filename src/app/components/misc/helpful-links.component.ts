import { Component, Input } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  selector: 'app-helpful-links',
  standalone: true,
  imports: [PrimeNgModule],
  template: `
    @if (links) {
      <div class="flex gap-3 flex-wrap">
        @for (link of links; track link) {
          <div>
            <a
              [routerLink]="link.location"
              class="w-48 px-1 py-2 text-center flex flex-col items-center gap-2 text-default no-underline rounded border-1 border-surface-400 hover:border-primary-400"
            >
              <h4 class="font-bold m-0">{{ link.title }}</h4>
              <i class="pi pi-{{ link.icon }} text-3xl"></i>
              <p class="m-0 text-sm italic opacity-70">{{ link.body }}</p>
            </a>
          </div>
        }
      </div>
    }
  `,
  styles: [],
})
export class HelpfulLinksComponent {
  @Input() links:
    | { location: string; title: string; icon: string; body: string }[]
    | undefined = [];
}
