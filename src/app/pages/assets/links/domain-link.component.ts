import { Component, Input, Output, EventEmitter } from '@angular/core';

import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  standalone: true,
  selector: 'app-domain-link',
  imports: [DomainFaviconComponent, PrimeNgModule],
  template: `
    <a
      [href]="linkUrl"
      target="_blank"
      (contextmenu)="onContextMenu($event)"
      class="p-card px-3 py-2 flex flex-col gap-1 w-full h-full no-underline justify-between overflow-hidden"
    >
      <h4 class="flex gap-2 my-0 text-lg font-semibold">
        <app-domain-favicon [domain]="linkUrl" [size]="24" />
        {{ linkName }}
      </h4>
      @if (linkDescription) {
        <p class="m-0 italic">{{ linkDescription }}</p>
      }

      @if (associatedDomains && associatedDomains.length) {
        <p class="m-0 text-sm text-gray-500" [pTooltip]="associatedDomains.join(', ')">
          @if (associatedDomains.length === 1) {
            Associated with {{ associatedDomains[0] }}
          } @else if (associatedDomains.length > 1) {
            Associated with {{ associatedDomains.length }} domains
          }
        </p>
      }
    </a>
  `,
})
export class DomainLinkComponent {
  @Input() linkUrl!: string;
  @Input() linkName!: string;
  @Input() linkDescription?: string;
  @Input() associatedDomains?: string[];
  @Output() contextMenu = new EventEmitter<MouseEvent>();

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenu.emit(event);
  }
}
