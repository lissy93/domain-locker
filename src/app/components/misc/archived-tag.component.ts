import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { PrimeNgModule } from '~/app/prime-ng.module';

/** Marks a domain as archived, with the date in its tooltip */
@Component({
  selector: 'app-archived-tag',
  standalone: true,
  imports: [PrimeNgModule, DatePipe, TranslateModule],
  template: `
    <p-tag
      icon="pi pi-archive"
      severity="secondary"
      styleClass="ml-2 text-xs"
      [value]="'DOMAINS.DOMAIN_COLLECTION.ARCHIVED' | translate"
      [pTooltip]="
        'DOMAINS.DOMAIN_COLLECTION.ARCHIVED_ON'
          | translate: { date: (archivedAt | date: 'mediumDate') }
      "
    />
  `,
})
export class ArchivedTagComponent {
  @Input({ required: true }) archivedAt!: string;
}
